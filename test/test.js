const _ = require('lodash')
const { expect } = require('chai')
const sinon = require('sinon')
const ACSQS = require('../index')

const name = 'acsqs'
const FAKE_ACCOUNT = '123456789012'
const FAKE_BUCKET = 'test-bucket'
const FAKE_QUEUE_ARN = `arn:aws:sqs:eu-central-1:${FAKE_ACCOUNT}:test_acsqs`

// Suppress logger output during tests
const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

function makeConfig(overrides = {}) {
  return {
    account: FAKE_ACCOUNT,
    availableLists: [{
      name,
      waitTime: 0,
      visibilityTimeout: 30,
      messageThreshold: 250e3
    }],
    useS3: {
      enabled: true,
      bucket: FAKE_BUCKET,
    },
    logger: silentLogger,
    batchExtendInterval: 50, // fast shutdown in tests
    ...overrides
  }
}


describe('Test basics', function () {
  let acsqs, sqsSend, s3Send
  let newMessage = {}
  const message = 'This is a message'

  before(() => {
    acsqs = new ACSQS(makeConfig())
    sqsSend = sinon.stub(acsqs.sqs, 'send')
    s3Send = sinon.stub(acsqs.s3, 'send')
  })

  after(async () => {
    await acsqs.shutdown()
    sinon.restore()
  })

  afterEach(() => {
    sqsSend.reset()
    s3Send.reset()
    acsqs.visibilityManagement.clear()
  })

  it('getAllLists', async () => {
    sqsSend.resolves({ $metadata: { httpStatusCode: 200 }, Attributes: { QueueArn: FAKE_QUEUE_ARN } })
    const response = await acsqs.getAllLists()
    expect(_.first(response)).to.have.property('value', FAKE_QUEUE_ARN)
  })

  it('sendSQSMessage', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: 'msg-id-1',
      MD5OfMessageBody: '78745dd27ccc2f660afba9841f58259b'
    })
    const response = await acsqs.sendSQSMessage({ name, message })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(response.MD5OfMessageBody).to.eql('78745dd27ccc2f660afba9841f58259b')
    newMessage = { Id: response.MessageId }
  })

  it('getQueueAttributes - shows 1 message', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Attributes: { ApproximateNumberOfMessages: '1' }
    })
    const response = await acsqs.getQueueAttributes({ name })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(response.Attributes.ApproximateNumberOfMessages).to.eql('1')
  })

  it('receiveSQSMessages', async () => {
    sqsSend.resolves({
      Messages: [{
        MessageId: 'msg-id-1',
        MD5OfBody: '78745dd27ccc2f660afba9841f58259b',
        Body: message,
        ReceiptHandle: 'rh-1'
      }]
    })
    const response = await acsqs.receiveSQSMessages({ name })
    const first = _.first(response)
    expect(first.MD5OfBody).to.eql('78745dd27ccc2f660afba9841f58259b')
    expect(first.Body).to.eql(message)
    expect(first).to.have.property('ReceiptHandle')
    newMessage.ReceiptHandle = first.ReceiptHandle
  })

  it('deleteSQSMessages', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Successful: [{ Id: 'msg-id-1' }],
      Failed: []
    })
    const response = await acsqs.deleteSQSMessages({ name, items: [newMessage] })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(_.first(response.Successful)).to.have.property('Id', newMessage.Id)
  })

  it('getQueueAttributes - shows 0 messages after delete', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Attributes: { ApproximateNumberOfMessages: '0' }
    })
    const response = await acsqs.getQueueAttributes({ name })
    expect(response.Attributes.ApproximateNumberOfMessages).to.eql('0')
  })

  it('receiveSQSMessages - returns undefined on empty queue', async () => {
    sqsSend.resolves({ Messages: [] })
    const response = await acsqs.receiveSQSMessages({ name })
    expect(response).to.be.undefined
  })

  it('sendSQSMessage - passes optional fields (groupId, deduplicationId, delay)', async () => {
    sqsSend.resolves({ $metadata: { httpStatusCode: 200 }, MessageId: 'msg-fifo-1' })
    await acsqs.sendSQSMessage({ name, message, messageGroupId: 'group1', deDuplicationId: 'dedup1', delay: 5 })
    const payload = sqsSend.firstCall.args[0].input
    expect(payload.MessageGroupId).to.eql('group1')
    expect(payload.MessageDeduplicationId).to.eql('dedup1')
    expect(payload.DelaySeconds).to.eql(5)
  })
})


describe('Test message batch', function () {
  let acsqs, sqsSend, s3Send
  let messageItems = []

  before(() => {
    acsqs = new ACSQS(makeConfig())
    sqsSend = sinon.stub(acsqs.sqs, 'send')
    s3Send = sinon.stub(acsqs.s3, 'send')
  })

  after(async () => {
    await acsqs.shutdown()
    sinon.restore()
  })

  afterEach(() => {
    sqsSend.reset()
    s3Send.reset()
    acsqs.visibilityManagement.clear()
  })

  it('sendSQSMessageBatch', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Successful: [
        { Id: '0', MD5OfMessageBody: '21fa8c4ea3be7cf61328c3f6aeb1dc78' },
        { Id: '1', MD5OfMessageBody: 'bfef4766d0fa3755cee4f499c5ab3626' }
      ],
      Failed: []
    })
    const messages = [{ messageBody: 'Message #1' }, { messageBody: 'Message #2' }]
    const response = await acsqs.sendSQSMessageBatch({ name, messages })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(_.last(response.Successful).MD5OfMessageBody).to.eql('bfef4766d0fa3755cee4f499c5ab3626')
  })

  it('receiveSQSMessages batch', async () => {
    sqsSend.resolves({
      Messages: [
        { MessageId: 'id-0', MD5OfBody: '21fa8c4ea3be7cf61328c3f6aeb1dc78', Body: 'Message #1', ReceiptHandle: 'rh-0' },
        { MessageId: 'id-1', MD5OfBody: 'bfef4766d0fa3755cee4f499c5ab3626', Body: 'Message #2', ReceiptHandle: 'rh-1' }
      ]
    })
    const response = await acsqs.receiveSQSMessages({ name })
    messageItems = response.map(item => _.pick(item, ['MessageId', 'ReceiptHandle']))
    expect(_.first(response).MD5OfBody).to.eql('21fa8c4ea3be7cf61328c3f6aeb1dc78')
    expect(_.first(response).Body).to.eql('Message #1')
    expect(_.last(response).MD5OfBody).to.eql('bfef4766d0fa3755cee4f499c5ab3626')
    expect(_.last(response).Body).to.eql('Message #2')
  })

  it('deleteSQSMessages batch', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Successful: messageItems.map(item => ({ Id: item.MessageId })),
      Failed: []
    })
    const response = await acsqs.deleteSQSMessages({ name, items: messageItems })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(_.first(response.Successful)).to.have.property('Id', _.first(messageItems).MessageId)
  })

  it('sendSQSMessageBatch - passes optional fields per entry', async () => {
    sqsSend.resolves({ $metadata: { httpStatusCode: 200 }, Successful: [], Failed: [] })
    const messages = [{
      messageBody: 'test',
      messageGroupId: 'g1',
      messageDeduplicationId: 'dedup1',
      delaySeconds: 10
    }]
    await acsqs.sendSQSMessageBatch({ name, messages })
    const entries = sqsSend.firstCall.args[0].input.Entries
    expect(entries[0].MessageGroupId).to.eql('g1')
    expect(entries[0].MessageDeduplicationId).to.eql('dedup1')
    expect(entries[0].DelaySeconds).to.eql(10)
  })
})


describe('Test with S3', function () {
  let acsqs, sqsSend, s3Send
  let newMessage = {}
  let bigMessage

  before(() => {
    const buffer = Buffer.alloc(400 * 1024)
    buffer.fill('A')
    bigMessage = buffer.toString()

    acsqs = new ACSQS(makeConfig())
    sqsSend = sinon.stub(acsqs.sqs, 'send')
    s3Send = sinon.stub(acsqs.s3, 'send')
  })

  after(async () => {
    await acsqs.shutdown()
    sinon.restore()
  })

  afterEach(() => {
    sqsSend.reset()
    s3Send.reset()
    acsqs.visibilityManagement.clear()
  })

  it('sendSQSMessage - stores large message in S3', async () => {
    s3Send.resolves({ $metadata: { httpStatusCode: 200 } })
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: 'msg-s3-1',
      MD5OfMessageBody: 'some-md5'
    })
    const response = await acsqs.sendSQSMessage({ name, message: bigMessage })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(s3Send.calledOnce).to.be.true
    const sqsPayload = sqsSend.firstCall.args[0].input
    expect(sqsPayload.MessageBody).to.match(/^s3:/)
    newMessage = { Id: response.MessageId }
  })

  it('receiveSQSMessages - retrieves large message body from S3', async () => {
    const s3Key = 'some-uuid-key'
    sqsSend.resolves({
      Messages: [{
        MessageId: 'msg-s3-1',
        Body: `s3:${s3Key}`,
        ReceiptHandle: 'rh-s3-1'
      }]
    })
    s3Send.resolves({
      Body: { transformToString: sinon.stub().resolves(bigMessage) }
    })
    const response = await acsqs.receiveSQSMessages({ name })
    const first = _.first(response)
    expect(first.Body).to.eql(bigMessage)
    expect(first.s3key).to.eql(s3Key)
    newMessage.ReceiptHandle = first.ReceiptHandle
    newMessage.s3key = first.s3key
  })

  it('deleteSQSMessages - triggers S3 cleanup for s3key', async () => {
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Successful: [{ Id: newMessage.Id }],
      Failed: []
    })
    s3Send.resolves({ $metadata: { httpStatusCode: 200 } })
    const response = await acsqs.deleteSQSMessages({ name, items: [newMessage] })
    expect(response.$metadata.httpStatusCode).to.eql(200)
    expect(sqsSend.calledOnce).to.be.true
  })
})


describe('Test visibility extension', function () {
  let acsqs, sqsSend

  before(() => {
    acsqs = new ACSQS(makeConfig({
      availableLists: [{
        name,
        waitTime: 0,
        visibilityTimeout: 30,
        messageThreshold: 250e3
      }]
    }))
    sqsSend = sinon.stub(acsqs.sqs, 'send')
    sinon.stub(acsqs.s3, 'send')
  })

  after(async () => {
    await acsqs.shutdown()
    sinon.restore()
  })

  afterEach(() => {
    sqsSend.reset()
    acsqs.visibilityManagement.clear()
  })

  it('receiveSQSMessages adds message to visibility tracking', async () => {
    sqsSend.resolves({
      Messages: [{ MessageId: 'vis-1', Body: 'test', ReceiptHandle: 'rh-1' }]
    })
    await acsqs.receiveSQSMessages({ name })
    expect(acsqs.getVisibilityStats().totalTracked).to.eql(1)
  })

  it('processBatchExtensions - extends visibility for due messages', async () => {
    acsqs.visibilityManagement.set('vis-1', {
      messageId: 'vis-1', queueName: name, receiptHandle: 'rh-1',
      extensionCount: 0, maxExtensions: 12,
      nextExtendTime: Date.now() - 1, createdAt: Date.now() - 5000
    })
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Successful: [{ Id: 'vis-1' }],
      Failed: []
    })
    await acsqs.processBatchExtensions()
    expect(sqsSend.calledOnce).to.be.true
    expect(acsqs.visibilityManagement.get('vis-1').extensionCount).to.eql(1)
    expect(acsqs.getVisibilityStats().totalTracked).to.eql(1)
  })

  it('processBatchExtensions - skips messages not yet due', async () => {
    acsqs.visibilityManagement.set('vis-future', {
      messageId: 'vis-future', queueName: name, receiptHandle: 'rh-2',
      extensionCount: 0, maxExtensions: 12,
      nextExtendTime: Date.now() + 60000, createdAt: Date.now()
    })
    await acsqs.processBatchExtensions()
    expect(sqsSend.called).to.be.false
  })

  it('processBatchExtensions - removes message when max extensions reached', async () => {
    acsqs.visibilityManagement.set('vis-max', {
      messageId: 'vis-max', queueName: name, receiptHandle: 'rh-max',
      extensionCount: 12, maxExtensions: 12,
      nextExtendTime: Date.now() - 1, createdAt: Date.now() - 10000
    })
    await acsqs.processBatchExtensions()
    expect(sqsSend.called).to.be.false
    expect(acsqs.visibilityManagement.has('vis-max')).to.be.false
  })

  it('processBatchExtensions - removes message on ReceiptHandleIsInvalid', async () => {
    acsqs.visibilityManagement.set('vis-invalid', {
      messageId: 'vis-invalid', queueName: name, receiptHandle: 'rh-invalid',
      extensionCount: 0, maxExtensions: 12,
      nextExtendTime: Date.now() - 1, createdAt: Date.now()
    })
    sqsSend.resolves({
      Successful: [],
      Failed: [{ Id: 'vis-invalid', Code: 'ReceiptHandleIsInvalid', Message: 'The receipt handle has expired.' }]
    })
    await acsqs.processBatchExtensions()
    expect(acsqs.visibilityManagement.has('vis-invalid')).to.be.false
  })

  it('deleteSQSMessages removes message from visibility tracking', async () => {
    acsqs.visibilityManagement.set('vis-1', {
      messageId: 'vis-1', queueName: name, receiptHandle: 'rh-1',
      extensionCount: 2, maxExtensions: 12,
      nextExtendTime: Date.now() + 10000, createdAt: Date.now()
    })
    sqsSend.resolves({
      $metadata: { httpStatusCode: 200 },
      Successful: [{ Id: 'vis-1' }],
      Failed: []
    })
    await acsqs.deleteSQSMessages({ name, items: [{ Id: 'vis-1', ReceiptHandle: 'rh-1' }] })
    expect(acsqs.visibilityManagement.has('vis-1')).to.be.false
    expect(acsqs.getVisibilityStats().totalTracked).to.eql(0)
  })

  it('addVisibilityTracking - rejects when maxConcurrentMessages is reached', () => {
    const limited = new ACSQS(makeConfig({ maxConcurrentMessages: 2, logger: silentLogger }))
    limited.addVisibilityTracking('m1', name, 'rh1', { visibilityTimeout: 30 })
    limited.addVisibilityTracking('m2', name, 'rh2', { visibilityTimeout: 30 })
    const result = limited.addVisibilityTracking('m3', name, 'rh3', { visibilityTimeout: 30 })
    expect(result).to.be.false
    expect(limited.visibilityManagement.size).to.eql(2)
    limited.shutdown()
  })

  it('getVisibilityStats - returns breakdown by queue', () => {
    // Use direct map manipulation to control createdAt timestamp reliably
    const past = Date.now() - 1000
    acsqs.visibilityManagement.set('stat-1', {
      messageId: 'stat-1', queueName: name, receiptHandle: 'rh-s1',
      extensionCount: 1, maxExtensions: 12,
      nextExtendTime: Date.now() + 10000, createdAt: past
    })
    acsqs.visibilityManagement.set('stat-2', {
      messageId: 'stat-2', queueName: name, receiptHandle: 'rh-s2',
      extensionCount: 3, maxExtensions: 12,
      nextExtendTime: Date.now() + 10000, createdAt: past + 100
    })
    const stats = acsqs.getVisibilityStats()
    expect(stats.totalTracked).to.eql(2)
    expect(stats.queueBreakdown[name]).to.eql(2)
    expect(stats.avgExtensions).to.eql(2) // (1+3)/2
    expect(stats.oldestMessage).to.not.be.null
    expect(stats.oldestMessage.messageId).to.eql('stat-1')
  })
})


describe('Test extendVisibility (legacy)', function () {
  let acsqs

  before(() => {
    acsqs = new ACSQS(makeConfig())
    sinon.stub(acsqs.sqs, 'send')
    sinon.stub(acsqs.s3, 'send')
  })

  after(async () => {
    await acsqs.shutdown()
    sinon.restore()
  })

  afterEach(() => acsqs.visibilityManagement.clear())

  it('adds untracked message to visibility tracking', async () => {
    const message = { MessageId: 'ext-1', ReceiptHandle: 'rh-ext-1' }
    await acsqs.extendVisibility({ name, message })
    expect(acsqs.visibilityManagement.has('ext-1')).to.be.true
  })

  it('forces immediate extension for already-tracked message', async () => {
    const message = { MessageId: 'ext-1', ReceiptHandle: 'rh-ext-1' }
    await acsqs.extendVisibility({ name, message })
    const tracking = acsqs.visibilityManagement.get('ext-1')
    // Set to future to detect the change
    tracking.nextExtendTime = Date.now() + 60000

    await acsqs.extendVisibility({ name, message })
    expect(tracking.nextExtendTime).to.be.lessThanOrEqual(Date.now())
  })

  it('throws configurationForListMissing for unknown queue', async () => {
    try {
      await acsqs.extendVisibility({ name: 'unknown', message: { MessageId: 'x', ReceiptHandle: 'y' } })
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('configurationForListMissing')
    }
  })
})


describe('Test createQueues', function () {
  let acsqs, sqsSend

  before(() => {
    acsqs = new ACSQS(makeConfig({
      availableLists: [{
        name,
        waitTime: 0,
        visibilityTimeout: 30,
        attributes: { MessageRetentionPeriod: '86400' }
      }]
    }))
    sqsSend = sinon.stub(acsqs.sqs, 'send')
    sinon.stub(acsqs.s3, 'send')
  })

  after(async () => {
    await acsqs.shutdown()
    sinon.restore()
  })

  afterEach(() => sqsSend.reset())

  it('skips creation if queue already exists', async () => {
    sqsSend.resolves({ QueueUrl: 'https://sqs.eu-central-1.amazonaws.com/123/test_acsqs' })
    await acsqs.createQueues({ lists: [{ name }] })
    expect(sqsSend.calledOnce).to.be.true
  })

  it('creates queue when it does not exist', async () => {
    sqsSend.onFirstCall().rejects(new Error('AWS.SimpleQueueService.NonExistentQueue'))
    sqsSend.onSecondCall().resolves({ QueueUrl: 'https://sqs.eu-central-1.amazonaws.com/123/test_acsqs' })
    await acsqs.createQueues({ lists: [{ name }], debug: true })
    expect(sqsSend.calledTwice).to.be.true
  })

  it('throws configurationForListMissing for unconfigured queue', async () => {
    try {
      await acsqs.createQueues({ lists: [{ name: 'unconfigured' }] })
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('configurationForListMissing')
    }
  })
})


describe('Error handling', function () {
  afterEach(() => sinon.restore())

  it('getAllLists - missing queue silently returns undefined value', async () => {
    const acsqs = new ACSQS(makeConfig())
    sinon.stub(acsqs.sqs, 'send').rejects(new Error('The specified queue does not exist.'))
    const response = await acsqs.getAllLists()
    expect(_.first(response)).to.have.property('value', undefined)
    await acsqs.shutdown()
  })

  it('getAllLists - throwError: true throws the error', async () => {
    const acsqs = new ACSQS(makeConfig({ throwError: true }))
    sinon.stub(acsqs.sqs, 'send').rejects(new Error('The specified queue does not exist.'))
    try {
      await acsqs.getAllLists()
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('The specified queue does not exist.')
    }
    await acsqs.shutdown()
  })

  it('getAllLists - throwError at function level throws the error', async () => {
    const acsqs = new ACSQS(makeConfig())
    sinon.stub(acsqs.sqs, 'send').rejects(new Error('The specified queue does not exist.'))
    try {
      await acsqs.getAllLists({ throwError: true })
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('The specified queue does not exist.')
    }
    await acsqs.shutdown()
  })

  it('sendSQSMessage - throws configurationForListMissing for unknown queue', async () => {
    const acsqs = new ACSQS(makeConfig())
    try {
      await acsqs.sendSQSMessage({ name: 'unknown', message: 'test' })
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('configurationForListMissing')
    }
    await acsqs.shutdown()
  })

  it('receiveSQSMessages - throws configurationForListMissing for unknown queue', async () => {
    const acsqs = new ACSQS(makeConfig())
    try {
      await acsqs.receiveSQSMessages({ name: 'unknown' })
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('configurationForListMissing')
    }
    await acsqs.shutdown()
  })

  it('deleteSQSMessages - returns early when items list is empty', async () => {
    const acsqs = new ACSQS(makeConfig())
    sinon.stub(acsqs.sqs, 'send')
    const response = await acsqs.deleteSQSMessages({ name, items: [] })
    expect(response).to.be.undefined
    expect(acsqs.sqs.send.called).to.be.false
    await acsqs.shutdown()
  })

  it('sendSQSMessage - throwError at function level', async () => {
    const acsqs = new ACSQS(makeConfig())
    sinon.stub(acsqs.sqs, 'send').rejects(new Error('ServiceUnavailable'))
    sinon.stub(acsqs.s3, 'send')
    try {
      await acsqs.sendSQSMessage({ name, message: 'test', throwError: true })
      expect.fail('Should have thrown')
    }
    catch(e) {
      expect(e.message).to.eql('ServiceUnavailable')
    }
    await acsqs.shutdown()
  })
})
