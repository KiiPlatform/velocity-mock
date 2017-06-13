
import { config } from "./config";
import * as fs from "fs"
import * as path from "path"
const commandLineArgs = require('command-line-args')
const csvjson = require('csvjson');

const optionDefinitions = [
    { name: 'help', alias: 'h' },
    { name: 'username', alias: 'u', type: String },
    { name: 'password', alias: 'p', type: String },
    { name: 'thing-id', alias: 't', type: String },
    { name: 'interval', alias: 'i', defaultValue: 5000, type: Number}
]
const options = commandLineArgs(optionDefinitions)

const kii = require('kii-cloud-sdk').create();
kii.Kii.initializeWithSite(config.appID, config.appKey, 'https://' + config.appHost + '/api');

const getUsage = require('command-line-usage')

const sections = [
    {
        header: 'Bike Mover',
        content: 'Generates smartbike [italic]{dummy} data.'
    },
    {
        header: 'Examples',
        content: [
            '$ node dist/index.js --username={username} --password={password} --thing-id={thing-id}',
            '$ node dist/index.js --username={username} --password={password} --thing-id={thing-id} --data={path to data file}',
            '$ node dist/index.js --username={username} --password={password} --thing-id={thing-id} --data={path to data file} --interval={interval in milliseconds}',
            '$ node dist/index.js --help'
        ]
    },
    {
        header: 'Options',
        optionList: optionDefinitions
    }
]
const usage = getUsage(sections)

if (options.help) {
    console.log(getUsage(sections));
    process.exit(0)
}

const groupName = 'vehicle-monitoring'
const thingID = options['thing-id'];
const username = options.username;
const password = options.password;
const interval = options.interval;
const csvPath = path.join(__dirname, '..', 'example', 'data.csv')
const csv  = fs.readFileSync(csvPath, 'utf8')
var csvOptions = {
  delimiter : ',', // optional 
  quote     : '"' // optional 
};
 
// for multiple delimiter you can use regex pattern like this /[,|;]+/ 
 
const data : [any] = csvjson.toObject(csv, csvOptions);
if (!thingID && !username && !password) {
    console.log("username, password and thing-id is mandatory");
    console.log(getUsage(sections));
    process.exit(0)
}

const bucketID = 'can-logger'
const maxLoops = data.length;
var counter = 0;
console.log("Total data :", data.length);
let user:any;

(function next() {
    if (counter++ >= maxLoops) {
        counter = 1
    }

    setTimeout(() => {
        console.log(counter);
        let record:any = data[counter - 1]
        console.log(record);
        
        kii.KiiUser.authenticate(username, password).then(
            (kiiuser: any) => {
                console.log('logged');
                user = kiiuser;
                var group = kii.KiiGroup.groupWithID(groupName);
                var bucket = group.bucketWithName(bucketID);
                if (counter == 1) {
                    console.log('Deleting bucket:');
                    return bucket.delete().catch((error:Error) => {
                        if (error.message.search(/.*BUCKET_NOT_FOUND*/) >= 0) {
                            return bucket;
                        } else {
                            throw error;
                        }
                    });
                } else {
                    return bucket;
                }
            }
        ).then(
            (bucket: any) => {
                console.log('Sending vehicle speed:' + record.CURRENT_SPEED );
                var obj = bucket.createObject();
                obj.set("UserID", user.getID());
                obj.set("ThingID", thingID);
                obj.set("velocity",record.vol);
                return obj.save()
            }
        ).then(
            (theObject: any) => {
                console.log('OK');
                next();
            }
        ).catch(
            (error: any) => {
                var errorString = error.message;
                console.log("error 1:" + errorString);
            }
        )
    }, interval);
})();

