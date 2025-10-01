const _ = require('lodash')
const { v4: uuidV4 } = require('uuid')
const { setTimeout: sleep } = require('timers/promises')

const { SQSClient, SendMessageCommand, SendMessageBatchCommand, ReceiveMessageCommand, DeleteMessageBatchCommand, GetQueueAttributesCommand, ChangeMessageVisibilityBatchCommand, GetQueueUrlCommand, CreateQueueCommand } = require('@aws-sdk/client-sqs')
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3")

class ACSQS {
  constructor({ region = 'eu-central-1', account, availableLists, useS3 = { enabled: true, bucket: undefined }, messageThreshold = 250e3, debug, logger = console, throwError = false, maxConcurrentMessages = 3000 }) {
    this.region = region
    this.account = account
    this.availableLists = availableLists
    this.logger = logger
    this.throwError = throwError
    this.maxConcurrentMessages = maxConcurrentMessages
    
    // Improved visibility management
    this.visibilityManagement = new Map()
    this.batchExtendRunning = false
    this.stopBatchExtend = false
    this.batchExtendInterval = 5000 // Check every 5 seconds

    const awsConfig = {
      region,
    }
    this.sqs = new SQSClient(awsConfig)

    // store huge messages in S3 and let SQS be the link to that message
    if (_.get(useS3, 'enabled')) {
      this.useS3 = true
      this.messageThreshold = messageThreshold
      this.bucket = _.get(useS3, 'bucket')
      this.s3 = new S3Client(awsConfig)
    }

    // Start batch extend loop
    this.startBatchExtendTimer()
  }

  async startBatchExtendTimer() {
    if (this.batchExtendRunning) return
    
    this.batchExtendRunning = true
    this.stopBatchExtend = false

    while (true) {
      try {
        if (this.stopBatchExtend) break
        
        await sleep(this.batchExtendInterval)
        
        if (this.stopBatchExtend) break
        
        await this.processBatchExtensions()
      }
      catch (error) {
        this.logger.error('ACSQS | startBatchExtendTimer | Error in batch extend loop | %s', error?.message)
        // Don't break the loop on errors, just log and continue
        await sleep(1000) // Wait 1s on error before retrying
      }
    }
    
    this.batchExtendRunning = false
  }

  stopBatchExtendTimer() {
    this.stopBatchExtend = true
  }

  async processBatchExtensions() {
    if (this.visibilityManagement.size === 0) return

    // Group messages by queue for batch processing
    const queueGroups = new Map()
    const now = Date.now()

    for (const [messageId, messageData] of this.visibilityManagement) {
      // Check if message still exists in tracking (might have been deleted)
      if (!this.visibilityManagement.has(messageId)) continue
      
      // Check if message needs extension
      if (now >= messageData.nextExtendTime) {
        // Check max extensions
        if (messageData.extensionCount >= messageData.maxExtensions) {
          this.logger.warn('ACSQS | processBatchExtensions | Max extensions reached | %s | %s', messageData.queueName, messageId)
          this.removeVisibilityTracking(messageId)
          continue
        }

        if (!queueGroups.has(messageData.queueName)) {
          queueGroups.set(messageData.queueName, [])
        }
        queueGroups.get(messageData.queueName).push(messageData)
      }
    }

    // Process each queue's extensions in batch
    for (const [queueName, messages] of queueGroups) {
      await this.extendVisibilityBatch(queueName, messages)
    }
  }

  async extendVisibilityBatch(queueName, messages) {
    if (messages.length === 0) return

    const config = _.find(this.availableLists, { name: queueName })
    if (!config) return

    const chunks = this.chunkMessages(messages)
    await this.processAllChunks(queueName, chunks, config)
  }

  chunkMessages(messages) {
    return _.chunk(messages, 10)
  }

  async processAllChunks(queueName, chunks, config) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      // Add delay between chunks to avoid throttling (except for first chunk)
      if (i > 0) {
        await sleep(100)
      }

      await this.processChunk(queueName, chunk, config, i + 1, chunks.length)
    }
  }

  async processChunk(queueName, chunk, config, chunkNumber, totalChunks) {
    const validChunk = this.getValidChunk(chunk)
    if (validChunk.length === 0) return

    const sqsParams = await this.buildSQSParams(validChunk, config)
    await this.executeChunkWithRetry(queueName, validChunk, sqsParams, config, chunkNumber, totalChunks)
  }

  getValidChunk(chunk) {
    return chunk.filter(messageData => this.visibilityManagement.has(messageData.messageId))
  }

  async buildSQSParams(validChunk, config) {
    const visibilityTimeout = _.get(config, 'visibilityTimeout', 30)
    const entries = validChunk.map(messageData => ({
      Id: messageData.messageId,
      ReceiptHandle: messageData.receiptHandle,
      VisibilityTimeout: visibilityTimeout
    }))
    const { queueUrl } = this.getQueueUrl(config)

    return {
      QueueUrl: queueUrl,
      Entries: entries
    }
  }

  async executeChunkWithRetry(queueName, validChunk, sqsParams, config, chunkNumber, totalChunks) {
    const maxRetries = 2
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        await this.handleRetryDelay(lastError, attempt, maxRetries, queueName, chunkNumber, totalChunks)
      }

      try {
        const command = new ChangeMessageVisibilityBatchCommand(sqsParams)
        const response = await this.sqs.send(command)
        
        const visibilityTimeout = _.get(config, 'visibilityTimeout', 30)
        this.handleChunkResponse(queueName, validChunk, response, config, visibilityTimeout)
        return
      }
      catch (error) {
        lastError = error
        
        if (this.isPermanentError(error)) {
          this.logger.warn('ACSQS | processChunk | Permanent error, not retrying | %s | %s', queueName, error.message)
          break
        }
        
        if (attempt < maxRetries) {
          this.logger.warn('ACSQS | processChunk | Attempt %s failed, will retry | %s | %s', 
            attempt, queueName, error.message)
        }
      }
    }

    this.handleAllRetriesFailed(queueName, validChunk, lastError)
  }

  async handleRetryDelay(lastError, attempt, maxRetries, queueName, chunkNumber, totalChunks) {
    const isThrottled = lastError?.message?.includes('throttled')
    const delayMs = isThrottled ? 500 : 200
    
    this.logger.warn('ACSQS | processChunk | Retry attempt %s/%s | %s | Chunk %s/%s | Waiting %sms', 
      attempt, maxRetries, queueName, chunkNumber, totalChunks, delayMs)
      
    await sleep(delayMs)
  }

  isPermanentError(error) {
    return error.message?.includes('ReceiptHandleIsInvalid') || 
           error.message?.includes('MessageNotInflight')
  }

  handleAllRetriesFailed(queueName, validChunk, lastError) {
    this.logger.error('ACSQS | processChunk | All retries failed | %s | Chunk size: %s | %s', 
      queueName, validChunk.length, lastError?.message)
    
    for (const messageData of validChunk) {
      this.removeVisibilityTracking(messageData.messageId)
    }
  }

  handleChunkResponse(queueName, validChunk, response, config, visibilityTimeout) {
    const successful = new Set((response.Successful || []).map(s => s.Id))
    const failed = new Set((response.Failed || []).map(f => f.Id))

    for (const messageData of validChunk) {
      // Check again if message still exists (might have been deleted during AWS call)
      if (!this.visibilityManagement.has(messageData.messageId)) continue
      
      if (successful.has(messageData.messageId)) {
        this.updateSuccessfulMessage(messageData, visibilityTimeout, queueName, config)
      }
      else if (failed.has(messageData.messageId)) {
        this.handleFailedMessage(messageData, response.Failed, queueName, config)
      }
    }
  }

  updateSuccessfulMessage(messageData, visibilityTimeout, queueName, config) {
    messageData.extensionCount++
    messageData.nextExtendTime = Date.now() + (visibilityTimeout * 0.8 * 1000)
    
    if (config.debug) {
      this.logger.debug('ACSQS | extendVisibilityBatch | Success | %s | M %s | %ss | Count: %s', 
        queueName, messageData.messageId, visibilityTimeout, messageData.extensionCount)
    }
  }

  handleFailedMessage(messageData, failedItems, queueName, config) {
    const failedItem = failedItems.find(f => f.Id === messageData.messageId)
    
    // Log only if it's not an expired receipt handle (which is normal)
    if (failedItem?.Code === 'ReceiptHandleIsInvalid') {
      if (config.debug) {
        this.logger.debug('ACSQS | extendVisibilityBatch | Receipt handle expired (normal) | %s | M %s', 
          queueName, messageData.messageId)
      }
    }
    else {
      this.logger.warn('ACSQS | extendVisibilityBatch | Failed | %s | M %s | %s', 
        queueName, messageData.messageId, failedItem?.Message || 'Unknown error')
    }
    
    // Remove from tracking if receipt handle expired or other permanent error
    if (failedItem?.Code === 'ReceiptHandleIsInvalid' || failedItem?.Code === 'MessageNotInflight') {
      this.removeVisibilityTracking(messageData.messageId)
    }
  }

  addVisibilityTracking(messageId, queueName, receiptHandle, config) {
    // Check if we're at max capacity
    if (this.visibilityManagement.size >= this.maxConcurrentMessages) {
      this.logger.warn('ACSQS | addVisibilityTracking | Max concurrent messages reached | %s', this.maxConcurrentMessages)
      return false
    }

    const visibilityTimeout = _.get(config, 'visibilityTimeout', 30)
    const maxExtensions = _.get(config, 'maxVisibilityExtensions', 12)

    this.visibilityManagement.set(messageId, {
      messageId,
      queueName,
      receiptHandle,
      extensionCount: 0,
      maxExtensions,
      nextExtendTime: Date.now() + (visibilityTimeout * 0.8 * 1000),
      createdAt: Date.now()
    })

    return true
  }

  removeVisibilityTracking(messageId) {
    this.visibilityManagement.delete(messageId)
  }

  // Legacy method for backwards compatibility - now uses batch processing
  async extendVisibility({ name, message, throwError }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | extendVisibility | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }

    const { MessageId: messageId } = message
    
    // Check if message is already being tracked
    if (this.visibilityManagement.has(messageId)) {
      // Force immediate extension by setting nextExtendTime to now
      const messageData = this.visibilityManagement.get(messageId)
      messageData.nextExtendTime = Date.now()
      return
    }

    // Add to tracking if not already present
    this.addVisibilityTracking(messageId, name, message.ReceiptHandle, config)
  }

  async getAllLists({ throwError = false } = {}) {
    let response = []
    for (const list of this.availableLists) {
      const attr = await this.getQueueAttributes({ name: list?.name, attributes: ['QueueArn'], throwError })
      response.push({ name: list?.name, value: attr?.Attributes?.QueueArn })
    }
    return response
  }

  getQueueUrl({ name, fifo, localPrefix, suffix }) {
    // Build queue name using array filtering for cleaner concatenation
    const queueName = [
      localPrefix && `local_${localPrefix}_`,
      process.env['NODE_ENV'] === 'test' && 'test_',
      name,
      suffix,
      fifo && '.fifo'
    ].filter(Boolean).join('')
    
    const queueUrl = `https://sqs.${this.region}.amazonaws.com/${this.account}/${queueName}`
    return { queueName, queueUrl }
  }

  async getQueueAttributes({ name, attributes = ['ApproximateNumberOfMessages'], throwError }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('ACSQS | getQueueAttributes | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
    const { queueUrl } = this.getQueueUrl(config)
    let sqsParams = {
      QueueUrl: queueUrl,
      AttributeNames: attributes
    }
    if (config.debug) this.logger.debug('ACSQS | getQueueAttributes | Payload %j', sqsParams)
    const command = new GetQueueAttributesCommand(sqsParams)
    try {
      return await this.sqs.send(command)
    }
    catch(e) {
      this.logger.error('ACSQS | getQueueAttributes | %s | %s', name, e?.message)
      if (this.throwError || throwError) throw e
    }
  }

  async createQueues({ lists, debug }) {
    for (const list of lists) {
      const config = _.find(this.availableLists, { name: list.name })
      if (!config) {
        this.logger.error('AWS | createQueue | configurationMissing | %s', list.name)
        throw new Error('configurationForListMissing')
      }

      const { queueName } = this.getQueueUrl(config)
        if (debug) this.logger.info('ACSQS | createQueues | %s | %s', list.name, queueName)
      const input = {
        QueueName: queueName
      }
      const checkCommand = new GetQueueUrlCommand(input)
      try {
        await this.sqs.send(checkCommand)
        continue
      }
      catch {
        if (!_.isEmpty(_.get(config, 'attributes'))) {
          input.Attributes = config.attributes
        }
        if (config?.fifo) input.Attributes = { ...input.Attributes, FifoQueue: 'true' }
        if (config?.visibilityTimeout) input.Attributes = { ...input.Attributes, VisibilityTimeout: config.visibilityTimeout }
        if (config?.delay) input.Attributes = { ...input.Attributes, DelaySeconds: config.delay }


        const command = new CreateQueueCommand(input)
        try {
          await this.sqs.send(command)
          if (debug) this.logger.info('ACSQS | createQueues | Created | %s | %s', list.name, queueName)
        }
        catch(e) {
          this.logger.error('AWS | createQueue | %s | %s', list.name, e?.message)
          if (this.throwError) throw e
        } 
      }
    }
  }

  async sendSQSMessage({ name, message, messageGroupId, deDuplicationId, delay, throwError, debug }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | sendSQSMessage | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }

    if (this.useS3 && message.length > this.messageThreshold) {
      // store message in S3
      const key = uuidV4()
      const input = {
        Bucket: this.bucket,
        Key: key,
        ContentType: 'text/plain',
        Body: Buffer.from(message, 'utf-8')     
      }
      const command = new PutObjectCommand(input)
      await this.s3.send(command)
      message = `s3:${key}`
    }

    const { queueUrl } = this.getQueueUrl(config)
    const sqsParams = {
      QueueUrl: queueUrl,
      MessageBody: message
    }
    if (messageGroupId) _.set(sqsParams, 'MessageGroupId', messageGroupId)
    if (deDuplicationId) _.set(sqsParams, 'MessageDeduplicationId', deDuplicationId)
    if (delay) _.set(sqsParams, 'DelaySeconds', delay)

    if (debug || config.debug) this.logger.debug('ACSQS | sendSQSMessage | Payload %j', sqsParams)
    const command = new SendMessageCommand(sqsParams)
    try {
      const response = await this.sqs.send(command)
      return response
    }
    catch(e) {
      this.logger.error('ACSQS | sendSQSMessage | %s | %s', name, e?.message)
      if (this.throwError || throwError) throw e
    }
  }

  async sendSQSMessageBatch({ name, messages, messageGroupId, deDuplicationId, delay, throwError, debug }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | sendSQSMessageBatch | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
  
    const processedMessages = await Promise.all(
      messages.map(async (message) => {
        let messageBody = message
        if (this.useS3 && message.length > this.messageThreshold) {
          // store message in S3
          const key = uuidV4()
          const input = {
            Bucket: this.bucket,
            Key: key,
            ContentType: 'text/plain',
            Body: Buffer.from(message, 'utf-8')
          }
          const command = new PutObjectCommand(input)
          await this.s3.send(command)
          messageBody = `s3:${key}`
        }
        return messageBody
      })
    )
  
    const entries = processedMessages.map((messageBody, index) => {
      const item = {
        Id: String(index),
        MessageBody: messageBody
      }
      if (messageGroupId) item.MessageGroupId = messageGroupId
      if (deDuplicationId) item.MessageDeduplicationId = `${deDuplicationId}-${index}`
      if (delay) item.DelaySeconds = delay
      return item
    })
  
    const { queueUrl } = this.getQueueUrl(config)
    const sqsParams = {
      QueueUrl: queueUrl,
      Entries: entries
    }
    if (debug || config.debug) this.logger.debug('ACSQS | sendSQSMessageBatch | Payload %j', sqsParams)
    
    const command = new SendMessageBatchCommand(sqsParams)
    try {
      const response = await this.sqs.send(command)
      return response
    }
    catch(e) {
      this.logger.error('ACSQS | sendSQSMessageBatch | %s | %s', name, e?.message)
      if (this.throwError || throwError) throw e
    }
  }

  async receiveSQSMessages({ name, throwError, debug }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('ACSQS | receiveSQSMessage | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
    const visibilityTimeout = _.get(config, 'visibilityTimeout') // if set, will activate visibilityTimeout management
  
    const { queueUrl } = this.getQueueUrl(config)
    const sqsParams = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: _.get(config, 'batchSize', 10),
      VisibilityTimeout: _.get(config, 'visibilityTimeout', 30),
      WaitTimeSeconds: _.get(config, 'waitTime', 20)
    }
    if (debug || config.debug) this.logger.debug('ACSQS | receiveSQSMessages | Payload %j', sqsParams)
    const command = new ReceiveMessageCommand(sqsParams)
    try {
      const result = await this.sqs.send(command)
      if (!_.size(result.Messages)) return
      
      const messages = await Promise.all(result.Messages.map(async (message) => {
        if (message.Body.startsWith('s3:')) {
          const key = message.Body.replace('s3:', '')
          try {
            const objectData = await this.fetchS3Object({ key })
            message.Body = objectData
            message.s3key = key
          }
          catch(e) {
            this.logger.error('ACSQS | receiveSQSMessages | s3KeyInvalid | %s | %s', name, key)         
          }
        }
  
        if (visibilityTimeout > 0) {
          // Add to visibility tracking instead of individual timers
          const { MessageId: messageId, ReceiptHandle: receiptHandle } = message
          this.addVisibilityTracking(messageId, name, receiptHandle, config)
        }
  
        return message
      }))
      return messages
    }
    catch(e) {
      this.logger.error('ACSQS | receiveSQSMessage | %s | %s', name, e?.message)
      if (this.throwError || throwError) throw e
    }
  }

  // items -> [{ Id, ReceiptHandle }]
  async deleteSQSMessages({ name, items, throwError, debug }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | deleteSQSMessage | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }

    if (!_.size(items)) {
      this.logger.error('AWS | deleteSQSMessage | %s | noItemsToDelete', name)
      return
    }

    const entries = []
    const s3keys = []
    for (const item of items) {
      const messageId = item.MessageId || item.Id
      entries.push({ Id: messageId, ReceiptHandle: item.ReceiptHandle })
      if (item.s3key) {
        s3keys.push({ Key: item.s3key })
      }
      // Remove from visibility tracking
      this.removeVisibilityTracking(messageId)
    }

    const { queueUrl } = this.getQueueUrl(config)
    const sqsParams = {
      QueueUrl: queueUrl,
      Entries: entries
    }
    if (debug || config.debug) this.logger.debug('ACSQS | deleteSQSMessages | Payload %j', sqsParams)
    const command = new DeleteMessageBatchCommand(sqsParams)
    try {
      const response = await this.sqs.send(command)
      // check cleaning up s3
      if (this.useS3 && _.size(s3keys)) {
        const input = {
          Bucket: this.bucket,
          Delete: { 
            Objects: s3keys,
          }
        }
        const command = new DeleteObjectsCommand(input)
        this.s3.send(command)
      }
      return response
    }
    catch(e) {
      this.logger.error('ACSQS | deleteSQSMessage | %s | %s', name, e?.message)
      if (this.throwError || throwError) throw e
    }
  }

  // Cleanup method for graceful shutdown
  async shutdown() {
    this.stopBatchExtendTimer()
    
    // Wait for batch extend loop to finish
    while (this.batchExtendRunning) {
      await sleep(100)
    }
    
    this.visibilityManagement.clear()
    this.logger.info('ACSQS | shutdown | Visibility management stopped and cleared')
  }

  // Get visibility tracking stats for monitoring
  getVisibilityStats() {
    const stats = {
      totalTracked: this.visibilityManagement.size,
      queueBreakdown: {},
      oldestMessage: null,
      avgExtensions: 0
    }

    let totalExtensions = 0
    let oldestTime = Date.now()

    for (const [messageId, data] of this.visibilityManagement) {
      if (!stats.queueBreakdown[data.queueName]) {
        stats.queueBreakdown[data.queueName] = 0
      }
      stats.queueBreakdown[data.queueName]++
      totalExtensions += data.extensionCount
      
      if (data.createdAt < oldestTime) {
        oldestTime = data.createdAt
        stats.oldestMessage = {
          messageId,
          age: Date.now() - data.createdAt,
          extensions: data.extensionCount
        }
      }
    }

    if (this.visibilityManagement.size > 0) {
      stats.avgExtensions = totalExtensions / this.visibilityManagement.size
    }

    return stats
  }

  // helpers
  async fetchS3Object({ key }) {
    const input = {
      Bucket: this.bucket,
      Key: key
    }
    const command = new GetObjectCommand(input)
  
    try {
      const response = await this.s3.send(command)
      return await response.Body.transformToString()
    } 
    catch (e) {
      this.logger.error('ACSQS | fetchS3Object | %j | %s', input, e?.message)
      throw e
    }
  }
}

module.exports = ACSQS