const _ = require('lodash')
const { v4: uuidV4 } = require('uuid')
const https = require('https')

const { fromNodeProviderChain } = require('@aws-sdk/credential-providers')
const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageBatchCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs')
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3")


class ACSQS {
  constructor({ region = 'eu-central-1', account, availableLists, profile = process.env['profile'], useS3 = { enabled: true, bucket: undefined }, messageThreshold = 250e3, debug, logger=console }) {
    const httpOptions = {
      keepAlive: true
    }

    this.region = region
    this.account = account
    this.availableLists = availableLists
    this.logger = logger

    const awsConfig = {
      region,
      credentials: fromNodeProviderChain({ profile, ignoreCache: true }),
      httpOptions: {
        agent: new https.Agent(httpOptions)
      }
    }
    if (debug && profile) {
      this.logger.log('ACSQS | Using AWS profile | %s', profile)
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

  async getAllLists() {
    let response = []
    for (const list of this.availableLists) {
      const attr = await this.getQueueAttributes({ name: list?.name, attributes: ['QueueArn'] })
      response.push({ name: list?.name, value: attr?.Attributes?.QueueArn })
    }
    return response
  }

  async getQueueUrl({ name, fifo, localPrefix }) {
    let queueUrl = `https://sqs.${this.region}.amazonaws.com/${this.account}/` 
    if (localPrefix) queueUrl += `local_${localPrefix}_`
    if (process.env['NODE_ENV'] === 'test') queueUrl += 'test_'
    queueUrl += name
    if (fifo) queueUrl += '.fifo'
    return queueUrl
  }

  async getQueueAttributes({ name, attributes = ['ApproximateNumberOfMessages'] }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('ACSQS | getQueueAttributes | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
    let sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      AttributeNames: attributes
    }
    const command = new GetQueueAttributesCommand(sqsParams)
    try {
      return await this.sqs.send(command)
    }
    catch(e) {
      this.logger.error('ACSQS | getQueueAttributes | %s | %s', name, e?.message)
    }
  }


  async sendSQSMessage({ name, message, messageGroupId, deDuplicationId, delay }) {
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

    const command = new SendMessageCommand(sqsParams)
    try {
      const response = await this.sqs.send(command)
      return response
    }
    catch(e) {
      this.logger.error('ACSQS | sendSQSMessage | %s | %s', name, e?.message)
    }
  }

  async receiveSQSMessages({ name }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | receiveSQSMessage | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }
    let sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      MaxNumberOfMessages: _.get(config, 'batchSize', 10),
      VisibilityTimeout: _.get(config, 'visibilityTimeout', 30),
      WaitTimeSeconds: _.get(config, 'waitTime', 20)
    }
    const command = new ReceiveMessageCommand(sqsParams)
    try {
      const result = await this.sqs.send(command)
      if (!_.size(result.Messages)) return
      const messages = await Promise.all(result.Messages.map(async message => {
        if (message.Body.startsWith('s3:')) {
          const key = message.Body.replace('s3:', '')
          try {
            const objectData = await this.fetchS3Object({ key })
            message.Body = objectData
            message.s3key = key
          }
          catch(e) {
            this.logger.error('AWS | receiveSQSMessages | s3KeyInvalid | %s', name, key)         
          }
        }
        return message
      }))
      return messages
    }
    catch(e) {
      this.logger.error('ACSQS | receiveSQSMessage | %s | %s', name, e?.message)
    }
  }

  // items -> [{ Id, ReceiptHandle }]
  async deleteSQSMessages({ name, items }) {
    const config = _.find(this.availableLists, { name })
    if (!config) {
      this.logger.error('AWS | deleteSQSMessage | configurationMissing | %s', name)
      throw new Error('configurationForListMissing')
    }

    const entries = []
    const s3keys = []
    for (const item of items) {
      entries.push({ Id: item.Id, ReceiptHandle: item.ReceiptHandle })
      if (item.s3key) {
        s3keys.push({ Key: item.s3key })
      }
    }

    let sqsParams = {
      QueueUrl: await this.getQueueUrl(config),
      Entries: entries
    }
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