
## [3.2.2](https://github.com/admiralcloud/ac-sqs/compare/v3.2.1..v3.2.2) (2025-09-19 05:21:22)


### Bug Fix

* **Misc:** Package updates | MP | [feed53274af621d33f5c03bf946d9d3274ad1986](https://github.com/admiralcloud/ac-sqs/commit/feed53274af621d33f5c03bf946d9d3274ad1986)    
Package updates  
Related issues:

## [3.2.1](https://github.com/admiralcloud/ac-sqs/compare/v3.2.0..v3.2.1) (2025-07-18 12:57:51)


### Bug Fix

* **App:** Reduced code complexity | MP | [0313cc01d90d9e4d1ad3b7ef3136af7dfc72d717](https://github.com/admiralcloud/ac-sqs/commit/0313cc01d90d9e4d1ad3b7ef3136af7dfc72d717)    
Create smaller functions  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
* **App:** Improved code quality | MP | [0d7e40518804f8c227cbc20c602510edada2e02e](https://github.com/admiralcloud/ac-sqs/commit/0d7e40518804f8c227cbc20c602510edada2e02e)    
Separated huge function into smaller parts  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
* **App:** Improved code quality | MP | [cd9f5d3969d4aac9c3c87e7e84dd5788e9929cce](https://github.com/admiralcloud/ac-sqs/commit/cd9f5d3969d4aac9c3c87e7e84dd5788e9929cce)    
Improved code quality  
Related issues:
* **App:** Requested code changes | MP | [39aa6c33b9087fcb2c3cfa075716a5dd83e07550](https://github.com/admiralcloud/ac-sqs/commit/39aa6c33b9087fcb2c3cfa075716a5dd83e07550)    
Improved code quality  
Related issues:
* **App:** Improved visibility management | MP | [d45111846668fe3db268fd40987c726e82e1074c](https://github.com/admiralcloud/ac-sqs/commit/d45111846668fe3db268fd40987c726e82e1074c)    
Add batch processing and throttling for visibility extension, better cleanup, graceful shutdown and stats  
Related issues:
### Chores

* **App:** Updated packages | MP | [c6a2d43081047626aa60d5cb5f97427760143880](https://github.com/admiralcloud/ac-sqs/commit/c6a2d43081047626aa60d5cb5f97427760143880)    
Updated packages  
Related issues:
 
# [3.2.0](https://github.com/admiralcloud/ac-sqs/compare/v3.1.2..v3.2.0) (2025-05-11 11:56:57)


### Feature

* **App:** Add sendMessageBatch function | MP | [996482f316a4220d6486df6e83a19b9e63a832f0](https://github.com/admiralcloud/ac-sqs/commit/996482f316a4220d6486df6e83a19b9e63a832f0)    
Add sendMessageBatch function  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
### Chores

* **App:** Updated packages | MP | [792e1b3ec19ee222242c07a3db7694a1f79c223f](https://github.com/admiralcloud/ac-sqs/commit/792e1b3ec19ee222242c07a3db7694a1f79c223f)    
Updated packages  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)

## [3.1.2](https://github.com/admiralcloud/ac-sqs/compare/v3.1.1..v3.1.2) (2025-04-23 07:40:43)


### Bug Fix

* **App:** Typo fix | MP | [b489342c092aae0b00691c28c46bed733a4d4823](https://github.com/admiralcloud/ac-sqs/commit/b489342c092aae0b00691c28c46bed733a4d4823)    
Fixed missing variable  
Related issues:
### Chores

* **App:** Updated packages | MP | [b031aaae6dc266584668577c008e4fd22254fc98](https://github.com/admiralcloud/ac-sqs/commit/b031aaae6dc266584668577c008e4fd22254fc98)    
Updated packages  
Related issues:

## [3.1.1](https://github.com/admiralcloud/ac-sqs/compare/v3.1.0..v3.1.1) (2025-04-12 09:17:43)


### Bug Fix

* **App:** Allow MessageId or Id for deletion requests | MP | [914e624a44c045771e3518eb94cb8dc6b8272bd4](https://github.com/admiralcloud/ac-sqs/commit/914e624a44c045771e3518eb94cb8dc6b8272bd4)    
Allow MessageId or Id for deletion requests  
Related issues:
 
# [3.1.0](https://github.com/admiralcloud/ac-sqs/compare/v3.0.0..v3.1.0) (2025-04-12 08:11:38)


### Feature

* **App:** Add visibilityTimeout management | MP | [ccdd4d0230fc98a5e1aa8531a9939ef2457b614a](https://github.com/admiralcloud/ac-sqs/commit/ccdd4d0230fc98a5e1aa8531a9939ef2457b614a)    
It is now possible to automatically extend visibility for messages. Just set visibilityTimeout in list config  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
### Documentation

* **App:** Added visibilityTimeout management  | MP | [4c6e916b0056c894dcac5cb58fa48166de769de4](https://github.com/admiralcloud/ac-sqs/commit/4c6e916b0056c894dcac5cb58fa48166de769de4)    
Added visibilityTimeout management  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
### Chores

* **App:** Updated packages | MP | [c2f533d3bd7bb0d9917d9815e46ef6e8ab5c79d2](https://github.com/admiralcloud/ac-sqs/commit/c2f533d3bd7bb0d9917d9815e46ef6e8ab5c79d2)    
Updated packages  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
<a name="3.0.0"></a>
 
# [3.0.0](https://github.com/admiralcloud/ac-sqs/compare/v2.0.8..v3.0.0) (2024-10-17 15:51:06)


### Bug Fix

* **App:** Do not set AWS profile | MP | [04b4e3c583844d998d3ace44d60456786a0129f9](https://github.com/admiralcloud/ac-sqs/commit/04b4e3c583844d998d3ace44d60456786a0129f9)    
Use profile from EC2 role or AWS_PROFILE  
Related issues: [master/issues#undefined](https://github.com/master/issues/undefined)
### Chores

* **App:** Updated packages | MP | [40b661a75293090f84c9fc93b38469e09b9de3a1](https://github.com/admiralcloud/ac-sqs/commit/40b661a75293090f84c9fc93b38469e09b9de3a1)    
Updated packages  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
## BREAKING CHANGES
* **App:** Use profile from EC2 role or AWS_PROFILE. NO more support for profile during init.
<a name="2.0.8"></a>

## [2.0.8](https://github.com/admiralcloud/ac-sqs/compare/v2.0.7..v2.0.8) (2024-10-16 13:20:21)


### Bug Fix

* **App:** Package updates | MP | [b9ceec9717166b22851618a22292ac5784d9d849](https://github.com/admiralcloud/ac-sqs/commit/b9ceec9717166b22851618a22292ac5784d9d849)    
Package updates  
Related issues: [undefined/undefined#master](undefined/browse/master)
<a name="2.0.7"></a>

## [2.0.7](https://github.com/admiralcloud/ac-sqs/compare/v2.0.6..v2.0.7) (2024-10-02 04:32:44)


### Bug Fix

* **App:** Added debug option | MP | [4ca1e0155758e98874b81a11e4c2ed491d1f1430](https://github.com/admiralcloud/ac-sqs/commit/4ca1e0155758e98874b81a11e4c2ed491d1f1430)    
If list is configured with debug=true, all SQS operations are logged  
Related issues: [undefined/undefined#master](undefined/browse/master)
### Chores

* **App:** Package fix | MP | [f5451d1fa4573b69cc523b5a71bee7a8f35d2a38](https://github.com/admiralcloud/ac-sqs/commit/f5451d1fa4573b69cc523b5a71bee7a8f35d2a38)    
Package fix  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
* **App:** Package fix | MP | [8f988ed8010b990d7fde443d49c14718f6c5c6f9](https://github.com/admiralcloud/ac-sqs/commit/8f988ed8010b990d7fde443d49c14718f6c5c6f9)    
Package fix for devDependecies  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
* **App:** Updated packages | MP | [6829c6438bf5352d19e9573bc7f1195218aedd6c](https://github.com/admiralcloud/ac-sqs/commit/6829c6438bf5352d19e9573bc7f1195218aedd6c)    
Updated packages  
Related issues: [undefined/undefined#master](undefined/browse/master)
<a name="2.0.6"></a>

## [2.0.6](https://github.com/admiralcloud/ac-sqs/compare/v2.0.5..v2.0.6) (2024-10-01 13:15:15)


### Bug Fix

* **App:** Allow throwError option on function level | MP | [be838a35c2f7220e594aed81f831bf2ca2a1b440](https://github.com/admiralcloud/ac-sqs/commit/be838a35c2f7220e594aed81f831bf2ca2a1b440)    
In addition to set it globally, you can now set throwError on function level  
Related issues: [/issues#undefined](https://github.com//issues/undefined)
<a name="2.0.5"></a>

## [2.0.5](https://github.com/admiralcloud/ac-sqs/compare/v2.0.4..v2.0.5) (2024-10-01 13:09:45)


### Bug Fix

* **App:** Allow throwError option  | MP | [821713678f99d87ac239d8511b5cca78de5d1b0b](https://github.com/admiralcloud/ac-sqs/commit/821713678f99d87ac239d8511b5cca78de5d1b0b)    
If true, errors are thrown instead of just logged  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
### Chores

* **App:** Updated packages | MP | [959ba2ed9847d20d16b5d50f568d7cabe9324d81](https://github.com/admiralcloud/ac-sqs/commit/959ba2ed9847d20d16b5d50f568d7cabe9324d81)    
Updated packages  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
<a name="2.0.4"></a>

## [2.0.4](https://github.com/admiralcloud/ac-sqs/compare/v2.0.3..v2.0.4) (2024-06-05 15:17:57)


### Bug Fix

* **App:** Package updates | MP | [a6c6c7cec0385768446ef635b6605bac9dfc7d40](https://github.com/admiralcloud/ac-sqs/commit/a6c6c7cec0385768446ef635b6605bac9dfc7d40)    
Package updates  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
<a name="2.0.3"></a>

## [2.0.3](https://github.com/admiralcloud/ac-sqs/compare/v2.0.2..v2.0.3) (2023-09-06 09:29:40)


### Bug Fix

* **App:** Allow suffix for lists | MP | [5b2395593896a83dd8bbd6a558e589c8d0a2f0c7](https://github.com/admiralcloud/ac-sqs/commit/5b2395593896a83dd8bbd6a558e589c8d0a2f0c7)    
Allow suffix for lists  
Related issues: [undefined/undefined#master](undefined/browse/master)
### Chores

* **App:** Updated packages | MP | [0a96ae8df4a46863bd8faeccdfde674b37338055](https://github.com/admiralcloud/ac-sqs/commit/0a96ae8df4a46863bd8faeccdfde674b37338055)    
Updated packages  
Related issues: [undefined/undefined#master](undefined/browse/master)
<a name="2.0.2"></a>

## [2.0.2](https://github.com/admiralcloud/ac-sqs/compare/v2.0.1..v2.0.2) (2023-08-26 14:18:17)


### Bug Fix

* **App:** Don't create an error mapping a non existing result when receiving messages | MP | [f24ac7d20edff29e8ded7f2eb8728910046ce62e](https://github.com/admiralcloud/ac-sqs/commit/f24ac7d20edff29e8ded7f2eb8728910046ce62e)    
My commit description  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
### Chores

* **App:** Updated packages | MP | [818c035b3375f2222d1b316d64273e48286b6aaf](https://github.com/admiralcloud/ac-sqs/commit/818c035b3375f2222d1b316d64273e48286b6aaf)    
Updated packages  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
<a name="2.0.1"></a>

## [2.0.1](https://github.com/admiralcloud/ac-sqs/compare/v2.0.0..v2.0.1) (2023-07-02 13:28:31)


### Bug Fix

* **App:** Add option to retrieve all available lists | MP | [3f6633cfad4b17f444373ca098831bd78bff51cc](https://github.com/admiralcloud/ac-sqs/commit/3f6633cfad4b17f444373ca098831bd78bff51cc)    
Add option to retrieve all available lists  
Related issues: [/issues#undefined](https://github.com//issues/undefined)
### Documentation

* **App:** Improved info about testing | MP | [d60cd85395e9a7cdd80fb31186913f5901c28daa](https://github.com/admiralcloud/ac-sqs/commit/d60cd85395e9a7cdd80fb31186913f5901c28daa)    
Improved info about testing  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
### Chores

* **App:** Updated packages | MP | [f2a69c23c58099ae460a6e1df0fc22356a1a2c52](https://github.com/admiralcloud/ac-sqs/commit/f2a69c23c58099ae460a6e1df0fc22356a1a2c52)    
Updated packages  
Related issues: [/issues#undefined](https://github.com//issues/undefined)
<a name="2.0.0"></a>
 
# [2.0.0](https://github.com/admiralcloud/ac-sqs/compare/v0.1.0..v2.0.0) (2023-04-29 06:19:35)


### Bug Fix

* **App:** An outdated/old version 1.x existed on npm.  | MP | [53697350d80126e40f91cc4470feb4b3ad216a4c](https://github.com/admiralcloud/ac-sqs/commit/53697350d80126e40f91cc4470feb4b3ad216a4c)    
An outdated/old version 1.x existed on npm.  
Related issues: [/issues#undefined](https://github.com//issues/undefined)
## BREAKING CHANGES
* **App:** An outdated/old version 1.x existed on npm.
<a name="0.1.0"></a>
 
# [0.1.0](https://github.com/admiralcloud/ac-sqs/compare/..v0.1.0) (2023-04-29 06:14:09)


### Feature

* **App:** Initial version | MP | [b4e87cdce80dd218d1be1c9dafca786d3fea15d0](https://github.com/admiralcloud/ac-sqs/commit/b4e87cdce80dd218d1be1c9dafca786d3fea15d0)    
Initial version  
Related issues: [admiralcloud/ac-sqs#1](https://github.com/admiralcloud/ac-sqs/issues/1) [admiralcloud/ac-api-server#340](https://github.com/admiralcloud/ac-api-server/issues/340)
