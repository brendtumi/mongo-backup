# MongoDb Backup cli
Cli for Automated MongoDB backup. Supports AWS S3 backups, Dropbox backups, Email/HTTP notifications, pre/post hooks and internal crontab.
Forked from https://github.com/brendtumi/mongo-backup
 
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Dependency Status][dependency-image]][dependency-url]

### Installation
Install with [npm](http://github.com/isaacs/npm):
```
npm install @settlin/mongo-backup -g
```
    
### Configuration
Example configuration file [examples/conf.json](examples/conf.json)

Create configuration file using 
```
mbk example <path for conf.json>
```

Use any command in [mongodump](https://docs.mongodb.com/manual/reference/program/mongodump/) with same name (without '--')

**`archive` options** 
* `gzip`
*this will automagically add --gzip and --archive arguments for compressing backup file*
* `tar` (default)
*will use `tar -zcvf` command to compress backup files*
* `zip`
*will use `zip -zcvf` command to compress backup files but `sudo apt-get install zip` should be installed* 

For example:
`excludeCollection: 'test'` will add `--excludeCollection test` to mongodump command.

**email notification** 
Look at [nodemailer](https://www.npmjs.com/package/nodemailer) for email notification support.
`%s` in email body will be replaced with backup result.

Sample backup result:
```javasript
{
    part: 'mongodb 127.0.0.1',
    steps: {
        '1': '2016-07-19T14:51:23+03:00',
        '2': '2016-07-19T14:51:23+03:00',
        '3': '2016-07-19T14:53:52+03:00',
        '4': '2016-07-19T15:26:50+03:00'
    },
    dump: {
        tmp: '/tmp/tmp-2721hWBSejbRpHQn',
        name: '2016-07-19_14-51.gz',
        output: '/tmp/tmp-2721hWBSejbRpHQn/2016-07-19_14-51.gz'
    },
    to: [{
        Expiration: 'expiry-date="Tue, 18 Oct 2016 00:00:00 GMT", rule-id="Rule for the Entire Bucket"',
        Location: 'https://xxxx.s3.eu-central-1.amazonaws.com/2016-07-19_14-51.gz',
        Bucket: 'backups',
        Key: '2016-07-19_14-51.gz',
        ETag: '"e1bfa5e25186e64b014db6f3af882534-84"'
    }]
}
```


### Running
Need help? use `--help` argument
```
mbk backup <path to conf.json>
```

##### Crontab
```
mbk backup <path to conf.json> --cron='* * * * * *'
```
But I need to close terminal window. How can I run without cancelling backup script?
Well use [*nohup*](https://en.wikipedia.org/wiki/Nohup) or use default job scheduler (crontab etc.)
```bash
nohup mbk backup /home/ubuntu/backup.json --cron='* 5 * * * *' > /home/ubuntu/backuplog.out 2> /home/ubuntu/backuplog.err < /dev/null &
```

##### Changing temporary directory
Temporary directory should be exist and must have appropriate write permissions. 
```
mbk backup <path to conf.json> --tmp='/absolute/and/existing/directory'
```

##### Debugging
```
mbk backup <path to conf.json> --debug
```

#### Contribution
This is a fairly new tool, so any contribution are welcomed.
What should we focus?
* FTP/SFTP support
* ~~Testing~~
* Amazon EFS
* Dropbox like support
* ~~Debugging~~
* ~~Temporary dir option~~

### Contributors
We welcome contributions of all kinds from anyone. 
* Author: [Tümay Çeber](https://github.com/brendtumi) [![](https://img.shields.io/gratipay/user/brendtumi.svg)](https://gratipay.com/brendtumi/)

#### My boss wants a license. So where is it?
[MIT License](./LICENSE)

[dependency-image]: https://david-dm.org/brendtumi/mongo-backup.svg?style=flat-square
[downloads-image]: http://img.shields.io/npm/dm/mongodbbackup.svg?style=flat-square
[npm-image]: https://img.shields.io/npm/v/mongodbbackup.svg?style=flat-square
[dependency-url]: https://david-dm.org/brendtumi/mongo-backup
[npm-url]: https://npmjs.org/package/mongodbbackup
