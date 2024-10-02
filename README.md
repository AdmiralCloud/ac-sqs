# AC SQS
This tool is a wrapper for AWS SDK's SQS function. It includes handling of big SQS messages using S3.

## Breaking changes - version 2
This new class-based wrapper is not compatible with older versions. 

# Usage

```
yarn add ac-sqs

const acsqs = new ACSQS({
  profile: 'development', // Optional AWS profile, see below
  account: '123456789', // AWS account id
  availableLists: [{
    name: 'listName'
    batchSize: 10
  }],
  useS3: {
    enabled: true,
    bucket: 'ac-sqs-messages' // s3 bucket
  }
})

await acsqs.sendSQSMessage({ name: listName, message: 'This is my message' })
```

# Available methods/calls
## Initiate class
**Account**
The ***account*** id of your AWS account. This is required

**Available lists**
Array of AWS SQS lists that will be used by this function. Every item in the list must be an object with the following properties:
+ name -> the name of the list in AWS SQS. See below for more info.
+ batchSize -> number of messages to fetch per call. Max 10, defaults to 1
+ visibilityTimeout -> see AWS SQS for details, defaults to 30
+ waitTime -> see AWS SQS for details, defaults to 20
+ fifo -> set to true, if this is a fifo list
+ localPrefix -> set your local prefix. See below for more info
+ debug -> if true, all SQS payloads for that list will be logged (level debug)
+ throwError -> if true, error will throw otherwise they will only be logged (default)

Name should be the plain name of the list. Parameters like fifo or test (in test environment) or localPrefixes (for local development) should not be part of the list name. LocalPrefix can be used if multiple developers work on your project and you want to make sure they all work on their own SQS list without changing the name of all SQS lists in your main project.

Example for a FIFO list:
Let the name be "mylist". This will automatically create "test_mylist" in test environment (NODE_ENV=test) and "local_LOCALPREFIX_mylist" if you set localPrefix.

**Profile [optional]**
By default the first AWS credentials in ~/.aws/credentials will be used.  You can also export an environment variable ***profile*** or send a named AWS profile.

**useS3 [optional]**
AWS SQS only allows a certain message size (262kb at the time of the documentation). To process messages with a bigger payload, the actual message content will be stored in a file on AWS S3. The feature is enabled by default and you must make sure to set a bucket.

```
useS3: {
  enabled: true,
  bucket: 'ac-sqs-message'
}
```

Make sure your function can read, write and delete messages in the bucket.

## sendSQSMessage
Create a messsage in a SQS list.

**name**
The name of the list to send a SQS message to.

**message**
The actual message (as plain test). If you want to send JSON, please stringify!

**messageGroupId [optional]**
See AWS SQS for details

**deDuplicationId [optional]**
See AWS SQS for details

**delay [optional]**
See AWS SQS for details

https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html

## receiveSQSMessages
Receive messages from SQS. By default up to 10 messages are fetched per call. You set a lower number using the batchSize parameter in the corresponding availableLists entry. 

**name**
The name of the list to receive a SQS messages from.

https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html

## deleteSQSMessages
Deletes one or multiple SQS messages and also cleans up/deletes related S3 files.

**name**
The name of the list to delete SQS messages from.

**items**
An array of objects to delete. Every objects must a least have properties ***Id*** and ***ReceiptHandle***. If the messages was originally stored on S3 the entry must also contain ***Key***.

The ***Id*** parameter is the message id, ***ReceiptHandle*** is an identifier you get with the receive request.

https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_DeleteMessageBatch.html

## getQueueAttributes
Get information about a list

**name**
The name of the list to get information about.

**attributes**
An array of metadata to get. By default only "ApproximateNumberOfMessages" is requested. Please see AWS SQS for other metadata options.

https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueAttributes.html

# Test
You can run tests using **yarn run test**.

Preparations you have to make before running the tests:

+ export the AWS profile to use for tests (if it is not your default profile) using  **export profile=development**
+ export the AWS account id using **export awsaccount=12345**
+ create a SQS list named "test_acsqs"
+ create a bucket and export the name using **export bucket=acsqs-test-bucket**
+ export the node test environment using **export NODE_ENV=test**

**ATTENTION**: Tests may fail when checking the SQS length. This is a by-design failure:
"ApproximateNumberOfMessages metrics may not achieve consistency until at least 1 minute after the producers stop sending messages."

See https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueAttributes.html

# Misc
## Links
- [Website](https://www.admiralcloud.com/)
- [Facebook](https://www.facebook.com/MediaAssetManagement/)

## License
[MIT License](https://opensource.org/licenses/MIT) Copyright © 2009-present, AdmiralCloud AG, Mark Poepping
