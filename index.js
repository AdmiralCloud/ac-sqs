const _ = require('lodash')
const { v4: uuidV4 } = require('uuid')

const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageBatchCommand, GetQueueAttributesCommand, ChangeMessageVisibilityCommand } = require('@aws-sdk/client-sqs')
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3")


class ACSQS {
  constructor({ region = 'eu-central-1', account, availableLists, useS3 = { enabled: true, bucket: undefined }, messageThreshold = 250e3, debug, logger=console, throwError = false }) {
    this.region = region
    this.account = account
    this.availableLists = availableLists
    this.logger = logger
    this.throwError = throwError
    this.visibilityTimer = {}

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
  }

  async getAllLists({ throwError = false } = {}) {
    let response = []
    for (const list of this.availableLists) {
      const attr = await this.getQueueAttributes({ name: list?.name, attributes: ['QueueArn'], throwError })
      response.push({ name: list?.name, value: attr?.Attributes?.QueueArn })
    }
    return response
  }

  async getQueueUrl({ name, fifo, localPrefix, suffix }) {
    let queueUrl = `https://sqs.${this.region}.amazonaws.com/${this.account}/` 
    if (localPrefix) queueUrl += `local_${localPrefix}_`
    if (process.env['NODE_ENV'] === 'test') queueUrl += 'test_'
    queueUrl += name
    if (suffix) queueUrl += suffix
    if (fifo) queueUrl += '.fifo'
    return queueUrl
  }

  async getQueueAttributes({ name, attributes = ['ApproximateNumberOfMessages'], throwError }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('ACSQS | getQueueAttributes | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
    let sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
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


  async sendSQSMessage({ name, message, messageGroupId, deDuplicationId, delay, throwError }) {
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

    const sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      MessageBody: message
    }
    if (messageGroupId) _.set(sqsParams, 'MessageGroupId', messageGroupId)
    if (deDuplicationId) _.set(sqsParams, 'MessageDeduplicationId', deDuplicationId)
    if (delay) _.set(sqsParams, 'DelaySeconds', delay)

    if (config.debug) this.logger.debug('ACSQS | sendSQSMessage | Payload %j', sqsParams)
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

  async extendVisibility({ name, message, throwError }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | extendVisibility | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }

    const visibilityTimeout = _.get(config, 'visibilityTimeout', 15)
    const maxVisibilityExtensions = _.get(config, 'maxVisibilityExtensions', 12) // max number of times the extension can me made (12 x 15s = 3min)
    
    const { MessageId: messageId, ReceiptHandle: receiptHandle } = message

     // Check if we've reached maximum extensions
    if (this.visibilityTimer[messageId] && this.visibilityTimer[messageId].visibilityExtensionCount >= maxVisibilityExtensions) {
      this.logger.warn('ACSQS | extendVisibility | %s | M %s | Max extensions reached | %s | %j', name, messageId, maxVisibilityExtensions, message)
      this.deleteVisibilityTimer({ messageId })
      return
    }
    
    // Track extension count
    if (this.visibilityTimer[messageId]) {
      this.visibilityTimer[messageId].visibilityExtensionCount++
    }
    
    const sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: visibilityTimeout
    }
    const command = new ChangeMessageVisibilityCommand(sqsParams)
    try {
      const response = await this.sqs.send(command)
      if (config.debug) {
        const visibilityExtensionCount = this.visibilityTimer[messageId] ? this.visibilityTimer[messageId].visibilityExtensionCount : 0
        this.logger.debug('ACSQS | extendVisibility | %s |  M %s | %ss | %s | %j', name, messageId, visibilityTimeout, visibilityExtensionCount, message)
      }

      return response
    }
    catch(e) {
      this.logger.error('ACSQS | extendVisibility | %s | %s', name, e?.message)
      this.deleteVisibilityTimer({ messageId })
      if (this.throwError || throwError) throw e
    }
  }

  deleteVisibilityTimer({ messageId }) {
    if (this.visibilityTimer[messageId]) {
      clearTimeout(this.visibilityTimer[messageId].timer)
      const self = this
      setTimeout(() => {
        delete self.visibilityTimer[messageId]
      }, 1000)
    }
  }

  async receiveSQSMessages({ name, throwError }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('ACSQS | receiveSQSMessage | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
    const visibilityTimeout = _.get(config, 'visibilityTimeout') // if set, will activate visibilityTimeout management
  
    const sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      MaxNumberOfMessages: _.get(config, 'batchSize', 10),
      VisibilityTimeout: _.get(config, 'visibilityTimeout', 30),
      WaitTimeSeconds: _.get(config, 'waitTime', 20)
    }
    if (config.debug) this.logger.debug('ACSQS | receiveSQSMessages | Payload %j', sqsParams)
    const command = new ReceiveMessageCommand(sqsParams)
    try {
      const result = await this.sqs.send(command)
      if (!_.size(result.Messages)) return
      
      // Benutze Arrow-Funktion, um `this` beizubehalten
      const messages = await Promise.all(result.Messages.map(async (message) => {
        if (message.Body.startsWith('s3:')) {
          const key = message.Body.replace('s3:', '')
          try {
            const objectData = await this.fetchS3Object({ key })
            message.Body = objectData
            message.s3key = key
          }
          catch(e) {
            this.logger.error('ACSQS | receiveSQSMessages | s3KeyInvalid | %s', name, key)         
          }
        }
  
        if (visibilityTimeout > 0) {
          // start visibility timer that automatically extends visibility of the message if required
          const { MessageId: messageId } = message
          const timeoutMs = Math.floor(visibilityTimeout * 0.8 * 1000)
          const self = this // `this` als lokale Variable speichern
          
          this.visibilityTimer[messageId] = {
            // Arrow-Funktion für setInterval damit `this` erhalten bleibt,
            // oder verwende die lokale Variable `self`
            timer: setInterval(() => {
              this.extendVisibility({ name, message })
                .catch(e => {
                  this.logger.error('ACSQS | AutoExtendVisibility | Failed %s', e.message)
                })
            }, timeoutMs),
            visibilityExtensionCount: 0
          }
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
  async deleteSQSMessages({ name, items, throwError }) {
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
      if (this.visibilityTimer[messageId]) {
        this.deleteVisibilityTimer({ messageId })
      }
    }


    let sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      Entries: entries
    }
    if (config.debug) this.logger.debug('ACSQS | deleteSQSMessages | Payload %j', sqsParams)
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
        const command = new DeleteObjectsCommand(input);
        this.s3.send(command)
      }
      return response
    }
    catch(e) {
      this.logger.error('ACSQS | deleteSQSMessage | %s | %s', name, e?.message)
      if (this.throwError || throwError) throw e
    }
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