// Web deployment helper. Read the password from stdin; never put it in source or shell arguments.
const bcrypt=require('bcryptjs');
let value='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>value+=chunk);
process.stdin.on('end',async()=>{const password=value.trimEnd();if(password.length<12||Buffer.byteLength(password)>72){console.error('Use 12 or more characters, at most 72 UTF-8 bytes');process.exitCode=1;return;}console.log(await bcrypt.hash(password,12));});
