# MongoDb Backup cli
Cli for Automated MongoDB backup. Supports AWS S3 backups, Email/HTTP notifications, pre/post hooks and internal crontab.
 
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Dependency Status][dependency-image]][dependency-url]

### Installation
Install with [npm](http://github.com/isaacs/npm):
```
npm install mongodbbackup -g
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

**email notification** 
Look at [nodemailer](https://www.npmjs.com/package/nodemailer) for email notification support.
`%s` in email body will be replaced with backup result.

### Running
Need help? use `--help` argument
```
mbk backup <path to conf.json>
```
##### Crontab
```
mbk backup <path to conf.json> --cron='* * * * * *'
```

[dependency-image]: https://david-dm.org/brendtumi/mongo-backup.svg
[downloads-image]: http://img.shields.io/npm/dm/mongodbbackup.svg
[npm-image]: https://img.shields.io/npm/v/mongodbbackup.svg
[dependency-url]: https://david-dm.org/brendtumi/mongo-backup
[npm-url]: https://npmjs.org/package/mongo-backup