# MongoDb Backup cli
Cli for Automated MongoDB backup. Supports AWS S3 backups, Email/HTTP notifications, pre/post hooks and internal crontab. 

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
* gzip
*this will automagically add --gzip and --archive arguments for compressing backup file*
* tar (default)
*will use `tar -zcvf` command to compress backup files*
* zip
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