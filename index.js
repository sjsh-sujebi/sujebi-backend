import express from 'express'
import fs from 'fs'
import cors from 'cors'
import { Web3 } from 'web3'
import https from 'https'
import { v4 as uuidv4 } from 'uuid';

var privateKey  = fs.readFileSync('/etc/letsencrypt/live/api.sujebi.tech/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/api.sujebi.tech/fullchain.pem', 'utf8');

const CONTRACT_ADDRESS = '0x57dee421776f250bc5fff320e2e48ad880bb1c35'
const web3 = new Web3("http://188.166.215.158:8545")

const ABI = JSON.parse(fs.readFileSync("./contractABI.json").toString())
const key = JSON.parse(fs.readFileSync("./accountKey.json").toString())
const wallet = await web3.eth.accounts.decrypt(key, "gom123#")

const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

async function uploadStudent(studentData) {
    const messageHash = web3.utils.sha3(studentData);
    const signature = await web3.eth.accounts.sign(messageHash, wallet.privateKey)
    await contract.methods.uploadStudent(messageHash, signature.v, signature.r, signature.s).send({ from : wallet.address })
    
    return messageHash
}

async function verifyStudent(messageHash) {
    return await contract.methods.verifyStudent(messageHash).call({ from : wallet.address})
}

async function addCompliment(value, hash, myHash) {
    const timestamp = Date.now().toString()

    await contract.methods.addCompliment(hash, myHash, value, timestamp).send({ from : wallet.address })
}

async function getCompliments(hash) {
    return await contract.methods.getCompliments(hash).call({ from : wallet.address})
}

// await uploadStudent(JSON.stringify({
//     "keyword1":"파인애플", 
//     "keyword2":"망고", 
//     "keyword3":"키위", 
//     "gradeNumber":"2",
//     "classNumber":"4",
//     "studentNumber":"17" 
//  }))

// console.log(await verifyStudent("0xa3a684edd6c9bc96bf9fdc8a69634524e5baefd976bd6e4592c16275ff05fc9d") == true)

const app = express()

app.use(express.json({limit: '100mb'}))
app.use(cors())

function readDB(filename) {
    return JSON.parse(fs.readFileSync(filename).toString())
}

app.post('/register', (req, res) => {
    try {
        const { keyword1, keyword2, keyword3, gradeNumber, classNumber, studentNumber, base64Image } = req.body

        const db = readDB('db.json')

        const myuuid = uuidv4()
        fs.writeFileSync(`./imgs/${myuuid}.jpg`, Buffer.from(base64Image, "base64"))
        
        db.pending.push({ keyword1, keyword2, keyword3, gradeNumber, classNumber, studentNumber, image: myuuid })

        fs.writeFileSync("db.json", JSON.stringify(db))

        res.json({
            is_success: true,
            payload: {
                msg: ""
            }
        })
    } catch (e) {
        res.json({
            is_success: false,
            payload: {
                msg: e
            }
        })
    }
})

app.post("/login", (req, res) => {
    try {
        
        const { keyword1, keyword2, keyword3, gradeNumber, classNumber, studentNumber } = req.body

        const db = readDB('users.json')
        for (const e of db.users) {
            if (e.keyword1 == keyword1 && e.keyword2 == keyword2 && e.keyword3 == keyword3  && e.studentNumber == studentNumber && e.gradeNumber == gradeNumber && e.classNumber == classNumber) {
                const messageHash = web3.utils.sha3(JSON.stringify(e));
                res.json({
                    is_success: true,
                    payload: {
                        msg: "Login success!",
                        userHash: messageHash
                    }
                })
                return
            }
        }

        res.json({
            is_success: false,
            payload: {
                msg: "Login failed!"
            }
        })
    } catch (e) {
        res.json({
            is_success: false,
            payload: {
                msg: e
            }
        })
    }
})

app.post("/verify", async (req, res) => {
    try {
        const { hash } = req.body
        const isBytes32 = (str) => {
            return /^0x[a-fA-F0-9]{64}$/.test(str);
        };
        if (!isBytes32(hash)) {
            res.json({
                is_success: false,
                payload: {
                    msg: "Verification Failed. Invalid hash format."
                }
            })
            return
        }
        if (await verifyStudent(hash)) {
            res.json({
                is_success: true,
                payload: {
                    msg: "Verification Success!",
                    hash: hash
                }
            })
        } else {
            res.json({
                is_success: false,
                payload: {
                    msg: "Verification Failed!"
                }
            })
        }
    } catch(e) {
        res.json({
            is_success: false,
            payload: {
                msg: e
            }
        })
    }
})

app.post("/createCompliment", async (req, res) => {
    const { value, hash, myHash } = req.body

    try {
        await addCompliment(value, hash, myHash)
        res.json({
            is_success: true,
            payload: {
                msg: "ok"
            }
        })
    } catch (e) {
        res.json({
            is_success: true,
            payload: {
                msg: e
            }
        })
    }
})

app.post("/getCompliments", async (req, res) => {
    const { hash } = req.body

    const compliments = await getCompliments(hash)

    res.json({
        is_success: true,
        payload: {
            msg: {
                compliments: compliments.map(({ from, message, timestamp }) => ({ from, message, timestamp }))
            }
        }
    })
})

app.listen(8081, () => {
    console.log("application up and listening to port: 8081")
})

https.createServer({key: privateKey, cert: certificate}, app).listen(8443, () => console.log("up"))