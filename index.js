import express from 'express'
import fs from 'fs'
import cors from 'cors'
import { Web3 } from 'web3'

const CONTRACT_ADDRESS = '0x365c4a9b9bc363d2973382ca0cdacbf274eeee71'
const web3 = new Web3("http://localhost:8545")

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
    await contract.methods.addCompliment(hash, myHash, value).send({ from : wallet.address })
}

async function getCompliments(hash) {
    return await contract.methods.getCompliments(hash).send({ from : wallet.address})
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
        db.pending.push({ keyword1, keyword2, keyword3, gradeNumber, classNumber, studentNumber, base64Image })
        
        fs.writeFileSync("db.json", JSON.stringify(db))
        res.send("ok")
    } catch (e) {
        res.send(e)
    }
})

app.post("/login", (req, res) => {
    try {
        
        const { keyword1, keyword2, keyword3, gradeNumber, classNumber, studentNumber } = req.body

        const db = readDB('users.json')
        for (const e of db.users) {
            if (e.keyword1 == keyword1 && e.keyword2 == keyword2 && e.keyword3 == keyword3  && e.studentNumber == studentNumber && e.gradeNumber == gradeNumber && e.classNumber == classNumber) {
                const messageHash = web3.utils.sha3(JSON.stringify(e));
                res.send(`ok:${messageHash}`)
                return
            }
        }

        res.send("error: nosuchuser")
    } catch (e) {
        res.send(e)
    }
})

app.post("/verify", async (req, res) => {
    try {
        const { hash } = req.body
        const isBytes32 = (str) => {
            return /^0x[a-fA-F0-9]{64}$/.test(str);
        };
        if (!isBytes32(hash)) {
            res.send("ok:false")
            return
        }
        res.send(`ok:${await verifyStudent(hash)}:${hash}`)
    } catch(e) {
        res.send(e)
    }
})

app.post("/createCompliment", async (req, res) => {
    const { value, hash, myHash } = req.body

    try {
        await addCompliment(value, hash, myHash)
        res.send("ok")
    } catch (e) {
        res.send(e)
    }
})

app.post("/getCompliments", async (req, res) => {
    const { hash } = req.body

    const compliments = await getCompliments(hash)
    res.send(compliments)
})

app.listen(8080, () => {
    console.log("application up and listening to port: 8080")
})