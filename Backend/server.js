import express from "express"
import { collectionName, connection } from "./dbconfig.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import cookieParser from "cookie-parser"
import cors from "cors"
import { ObjectId } from "mongodb"
import multer from "multer"
import { v2 as cloudinary } from "cloudinary"
// sockets-------
import http from "http"
import { Server } from "socket.io"

//  // --------------
const app = express()
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

//  create a list of online users
const onlineUsers = new Map()
// -----------------------------

// ---------------- 
const server = http.createServer(app)
// ---------------- 

// create a socket server---- 
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true
    }
})
// --------------------------


// socket connection---------
io.on("connection", (socket) => {

    console.log("User connected : ", socket.id)
    const email = socket.handshake.auth.email

    if (!email) return;

    // store client email in socket object 

    socket.email = email
    onlineUsers.set(email, socket.id)

    // emit online users
    io.emit("online-users", [...onlineUsers.keys()])
    // -------------------

    console.log("online : ", email)
    // -----------------------------------

    // real time message event------------ 
    socket.on("send-msg", (message) => {

        console.log("📩 receiver:", message.receiver);
        console.log("🗺 onlineUsers:", [...onlineUsers.entries()]);

        const receiverSocketId = onlineUsers.get(message.receiver)

        console.log("friend : ", receiverSocketId)

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive-message", message)
        }
    })
    // ----------------------------------- 

    // ----------------user offline-------
    socket.on("user-offline", async () => {

        if (socket.email) {
            onlineUsers.delete(socket.email)

            const db = await connection()
            const collection = await db.collection(collectionName)

            await collection.updateOne(
                { email: socket.email },
                {
                    $set: {
                        lastSeen: new Date()
                    }
                }
            )
            io.emit("online-users", [...onlineUsers.keys()])
        }
    })
    // -----------------------------------

    // typing indicator ------------------
    socket.on("typing-start", ({ receiver, chatId }) => {
        const receiverSocketId = onlineUsers.get(receiver)

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", {
                chatId,
                typing: true,
                from: socket.email
            })
        }
    })

    socket.on("typing-stop", ({ receiver, chatId }) => {
        const receiverSocketId = onlineUsers.get(receiver)

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", {
                chatId,
                typing: false,
                from: socket.email
            })
        }
    })
    // -----------------------------------


    // connection closes------------------
    socket.on("disconnect", async () => {

        if (socket.email && onlineUsers.get(socket.email) === socket.id) {

            onlineUsers.delete(socket.email);

            const db = await connection()
            const collection = await db.collection(collectionName)

            await collection.updateOne(
                { email: socket.email },
                {
                    $set: { lastSeen: new Date() }
                }
            )
            io.emit("online-users", [...onlineUsers.keys()])

            console.log("❌ Offline : ", email);
        }

    })
})
// -----------------------------------


const storage = multer.memoryStorage()
const upload = multer({ storage })
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET
});

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        `
    default-src 'self';
    connect-src 'self' http://localhost:5200 ws://localhost:5200 https://res.cloudinary.com;
    img-src 'self' data: https://res.cloudinary.com;
    media-src https://res.cloudinary.com;
    frame-src https://res.cloudinary.com;
    `
            .replace(/\s{2,}/g, " ")
            .trim()
    );
    next();
});



// -------------------User Auth Routes ----------------------------- 
app.get("/", (req, resp) => {
    resp.send("Server is working...")
})

// logout======================================= 
app.get("/logout", (req, resp) => {
    resp.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    })
    resp.send({
        success: true, msg: "user successfully logged out!"
    })
})
// =============================================

// signUp ====================================== 
app.post("/signUp", async (req, resp) => {
    try {
        const { name, email, password } = req.body

        // checking missing fields ======================
        if (!name || !email || !password) {
            return resp.send({ msg: "All fields are not provided!", success: false })
        }
        // =============================================

        // checking email validation =====================
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return
            resp.send({ msg: "Invalid email id", success: false })
        }
        // ================================================ 

        const db = await connection()
        const collection = await db.collection(collectionName)
        const user_found = await collection.findOne({ email: email })

        // user already exists with same email id 
        if (user_found) { return resp.send({ msg: "User already exist with same email!", exist: true, success: false }) }
        // ====================================== 

        // password bcrypting ------------------------- 
        const hashed_password = await bcrypt.hash(password, 10)
        // ------------------------------------------------ 

        //  store new user in database ----------- 
        const user = { name: name, email: email, password: hashed_password, profile_img_url: "https://res.cloudinary.com/dxbt6iugp/image/upload/v1767767832/c3fuqbsbaqtazsmlxcor.jpg" }
        const result = await collection.insertOne(user)

        if (result) {

            // generating token --------------------- 

            const token = jwt.sign({ email: user.email },
                process.env.SECRET_KEY, { expiresIn: "1d" }
            )
            resp.cookie("token", token,
                {
                    httpOnly: true, secure: false, sameSite: "lax"
                })
            resp.send({
                msg: "Sign up done!",
                user, exist: false,
                success: true
            })
        }
        else {
            resp.send({
                msg: "Sign up failed!",
                exist: false,
                success: false
            })
        }
    }
    catch (error) {
        resp.status(500).send(error.message)
    }
})

// login =======================================
app.post("/login", async (req, resp) => {
    try {
        const { email, password } = req.body

        // checking missing fields ======================

        if (!email || !password) {

            return resp.send({
                msg: "All fields are not provided!",
                success: false
            })
        }
        // ============================================= 

        // checking email validation =====================
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) { return resp.send({ msg: "Invalid email id", success: false }) }
        // ================================================


        const db = await connection()
        const collection = await db.collection(collectionName)

        // find user -----------------------------------
        const user = await collection.findOne({ email: email })
        if (!user) { return resp.send({ msg: "User not Found!", success: false, exist: false }) }
        // ----------------------------------------------

        const match = await bcrypt.compare(password, user.password)

        if (!match) {
            return resp.send({
                msg: "Incorrect Password!",
                success: false,
                exist: true
            })
        }

        const token = jwt.sign({ email: email }, process.env.SECRET_KEY, { expiresIn: "1d" })

        resp.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false
        })

        resp.send({ msg: "Login done!", success: true, exist: true })

        // ======================================
    } catch (error) {
        console.log(error.message)
        resp.status(500).send(error.message)
    }
})
// =============================================

// search user =================================
app.post("/search", verifyJWTToken, async (req, resp) => {
    const { name } = req.body
    try {

        const db = await connection(); const collection = await db.collection(collectionName)
        const result = await collection.find({ name: name }).project({ password: 0 }).toArray()

        resp.send({
            success: true,
            msg: "Data fetched successfully!",
            result
        })
    }
    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// ============================================= 

// edit user profile ===========================
app.patch("/edit", verifyJWTToken, upload.single("profile-image"), async (req, resp) => {
    if (!req.file) {

        return resp.status(400).send({
            successs: false,
            msg: "Media file is not provided!"
        })

    }
    try {

        const db = await connection();
        const collection = await db.collection(collectionName)

        const { email } = req.user

        const uploadStream = cloudinary.uploader.upload_stream({
            resource_type: "image"
        },
            async (error, uploadResult) => {

                if (error) {
                    return
                    resp.send({
                        success: false,
                        msg: error.message
                    })
                }

                await collection.updateOne({ email: email }, { $set: { profile_img_url: uploadResult.secure_url } })

                resp.send({ success: true, msg: "Profile image set successfully!", profile_img_url: uploadResult.secure_url })
            })
        uploadStream.end(req.file.buffer)
    } catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// ============================================= 

app.get("/get-friend-email/:chatId", verifyJWTToken, async (req, resp) => {
    try {
        const myEmail = req.user.email;

        const db = await connection();
        const chatsCollection = await db.collection("chats")

        const { chatId } = req.params

        const result = await chatsCollection.findOne({ _id: new ObjectId(chatId) })
        const friendEmail = result.users.find(u => u !== myEmail)

        resp.send({
            success: true,
            friendEmail
        })
    }
    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})

// get user profile data ======================= 
app.post("/userProfile", verifyJWTToken, async (req, resp) => {
    try {
        const db = await connection();
        const collection = await db.collection(collectionName)
        const { email } = req.body
        const result = await collection.findOne({ email: email }, { projection: { password: 0 } })
        resp.send({ success: true, msg: "data fetched", result })
    } catch (error) {
        resp.status(500).send({
            success: false, msg: error.message
        })
    }
})
// ============================================= 

app.get("/user-profile-by-id/:id", verifyJWTToken, async (req, resp) => {
    try {
        const db = await connection();
        const collection = await db.collection(collectionName)

        const { id } = req.params
        const result = await collection.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } })
        resp.send({
            success: true,
            msg: "data fetched",
            result
        })
    } catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})


app.post("/getChatId", verifyJWTToken, async (req, resp) => {
    try {
        const { otherUser } = req.body;
        const myEmail = req.user.email

        const db = await connection();
        const chatsCollection = await db.collection("chats")

        const result = await chatsCollection.findOne({ users: { $all: [myEmail, otherUser] } })

        if (result) {
            resp.send({
                success: true,
                chatId: result._id
            })
        }
        else {
            resp.send({
                success: false,
                chatId: null
            })
        }
    } catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})

// -----------------------CHAT ROUTES -------------------------------------

// chat-creation with another user -------------
app.post("/create-chat", verifyJWTToken, async (req, resp) => {

    const { otherUser } = req.body
    const myEmail = req.user.email

    try {

        const db = await connection()
        const chatsCollection = await db.collection("chats")

        let chat = await chatsCollection.findOne({ users: { $all: [myEmail, otherUser] } })

        if (!chat) {
            let result = await chatsCollection.insertOne({
                users: [myEmail, otherUser],
                lastMessage: "",
                hiddenFor: [],
                updatedAt: new Date()
            })
            chat = await chatsCollection.findOne({ _id: result.insertedId })
        }
        else {
            await chatsCollection.updateOne({ _id: chat._id }, { $pull: { hiddenFor: myEmail } })
        }

        return resp.send({ success: true, chat })
    }

    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// --------------------------------------------- 


// send messages --------------------------------
app.post("/send-message", verifyJWTToken, async (req, resp) => {

    const { chatId, msgType, text, resourceType, fileName, format } = req.body;

    if (!chatId || !msgType || !text) {
        return resp.send({
            success: false,
            message: "Invalid message data!"
        })
    }

    const myEmail = req.user.email

    try {

        const db = await connection()
        const chatsCollection = await db.collection("chats")
        const messageCollection = await db.collection("messages")

        let msg = await messageCollection.insertOne({
            chatId: new ObjectId(chatId),
            sender: myEmail,
            msgType: msgType,
            text: text,  //public_id
            resourceType,
            fileName,
            deletedFor: [],
            createdAt: new Date()
        })

        await chatsCollection.updateOne({ _id: new ObjectId(chatId) }, {
            $set: {
                lastMessage: msgType === "text_msg" ? text : msgType,
                updatedAt: new Date()
            }
        })

        const message = {
            _id: msg.insertedId,
            chatId: chatId,
            sender: myEmail,
            text: text,
            resourceType,
            fileName,
            msgType: msgType,
            createdAt: new Date()
        }

        resp.send({
            success: true,
            message
        })

    }
    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// -----------------------------------------------

// download media files (pdf or docs) ------------
app.get("/download/:messageId", verifyJWTToken, async (req, resp) => {
    const { messageId } = req.params

    try {
        const db = await connection()
        const chatsCollection = await db.collection("chats")
        const messageCollection = await db.collection("messages")

        const msg = await messageCollection.findOne({ _id: new ObjectId(messageId) })

        if (!msg) {
            return resp.status(404).send({
                success: false,
                message: "file not found"
            })
        }

        const chat = await chatsCollection.findOne({ _id: new ObjectId(msg.chatId) })

        if (!chat) {
            return resp.status(403).send("Forbidden")
        }

        const downloadUrl = cloudinary.url(msg.text, {
            // resource_type: "raw",
            resource_type:msg.resourceType,
            flags: "attachment",
            sign_url: true
        });

        return resp.redirect(downloadUrl);

    }
    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }

})
// ---------------------------------------------


//  // fetch all messages of a chat ------------------
app.get("/messages/:chatId", verifyJWTToken, async (req, resp) => {
    const { chatId } = req.params
    try {
        const db = await connection()
        const messageCollection = await db.collection("messages")
        const messages = await messageCollection.find({
            chatId: new ObjectId(chatId),
            $or: [
                { deletedFor: { $exists: false } },
                { deletedFor: { $size: 0 } },
                { deletedFor: { $not: { $elemMatch: { $eq: req.user.email } } } }
            ]
        }).sort({ createdAt: 1 }).toArray()

        resp.send({
            success: true,
            messages
        })
    }
    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// ----------------------------------------------- 

const uploadOneFile = (file) => {
    return new Promise((resolve,reject) =>{

         const mime = file.mimetype;

        let resourceType = "raw"; // default for docs/pdf/zip
        if (mime.startsWith("image/")) resourceType = "image";
        else if (mime.startsWith("video/") || mime.startsWith("audio/")) resourceType = "video";

        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType },
            async (error, uploadResult) => {

                // if upload fails
                if (error) {
                   reject(error)
                }

                // return response

                resolve({
                        public_id: uploadResult.public_id,
                        resource_type: uploadResult.resource_type,
                        format: uploadResult.format,                 
                        original_name: file.originalname
                    })

            })
        uploadStream.end(file.buffer)
    })
}


// // ---- generate media url -------------------- 
app.post("/upload-media", verifyJWTToken, upload.array("media",10), async (req, resp) => {
    
    

    if (req.files.length == 0) {
        return resp.status(400).send({
            success: false,
            msg: "File not provided!"
        })
    }

    try {
       
        const result = await Promise.all(
            req.files.map(file => uploadOneFile(file))
        )
       
        return resp.send({
            success:true,
            media:result
        })
       
    }
    catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
}
)
// -------------------------------------------- 


// // fetch all friends -------------------------- 
app.get("/friends", verifyJWTToken, async (req, resp) => {
    const myEmail = req.user.email
    try {

        const db = await connection()
        const chatsCollection = await db.collection("chats")
        const collection = await db.collection(collectionName)

        // get all chats of the user
        const chats = await chatsCollection.find({
            users: { $in: [myEmail] },
            hiddenFor: { $nin: [req.user.email] }
        }).toArray()

        //unique friend emails 
        let friendEmails = chats.flatMap(chat => chat.users).filter(email => email !== myEmail)
        friendEmails = [...new Set(friendEmails)]

        // extract friends profile
        let friends = await collection.find({ email: { $in: friendEmails } }).project({ password: 0 }).toArray()

        // merge chat info with each friend 
        const result = friends.map(friend => {
            const chat = chats.find(c => c.users.includes(friend.email));
            return {
                _id: friend._id,
                name: friend.name,
                email: friend.email,
                profile_img_url: friend.profile_img_url,
                lastMessage: chat?.lastMessage || "",
                updatedAt: chat?.updatedAt || null,
                chatId: chat?._id
            };
        });
        resp.send({
            success: true,
            result
        })
    } catch (error) {
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// -------------------------------------------- 


// clear all messages or clear chat ------------------------- 
app.delete("/clear-chat/:chatId", verifyJWTToken, async (req, resp) => {
    try {
        const { chatId } = req.params
        const db = await connection()
        const messageCollection = await db.collection("messages")

        await messageCollection.updateMany({
            chatId: new ObjectId(chatId)
        },
            {
                $addToSet: { deletedFor: req.user.email }
            }
        )
        resp.send({
            success: true,
            msg: "Chats deleted succcessfully!"
        })
    }
    catch (error) {
        console.log(error.message)

        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// -------------------------------------------- 


// delete message for me ------
app.delete("/delete-message/:id", verifyJWTToken, async (req, resp) => {
    try {
        const { id } = req.params
        const db = await connection()
        const messageCollection = await db.collection("messages")
        await messageCollection.updateOne({ _id: new ObjectId(id) }, {
            $addToSet: { deletedFor: req.user.email }
        })
        resp.send({
            success: true,
            msg: "Message deleted succcessfully!"
        })
    } catch (error) {
        console.log(error.message)
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// --------------------------------------------


// delete chat---------------------------------- 
app.delete("/delete-chat/:chatId", verifyJWTToken, async (req, resp) => {

    try {

        const { chatId } = req.params
        const myEmail = req.user.email

        const db = await connection()
        const chatsCollection = db.collection("chats")
        const messageCollection = db.collection("messages")

        await chatsCollection.updateOne({ _id: new ObjectId(chatId) }, {
            $addToSet: { hiddenFor: myEmail }
        })

        await messageCollection.updateMany({ chatId: new ObjectId(chatId) }, { $addToSet: { deletedFor: myEmail } })

        resp.send({
            success: true,
            msg: "Chat cleared successfully!"
        })

    }
    catch (error) {

        console.log("Error occured:", error.message)
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})


// delete messsage for everyone 
app.post("/delete-message-for-everyone", verifyJWTToken, async (req, resp) => {
    try {
        const { msgId, createdAt, chatId } = req.body

        const db = await connection()
        const messageCollection = await db.collection("messages")
        const chatsCollection = await db.collection("chats")

        const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) })

        if (!chat) {
            console.log("Error : chat does not exist")

            return resp.send({
                success: false,
                msg: "Chat does not exist"
            })
        }

        // check time limit
        const diffMinutes = (Date.now() - new Date(createdAt)) / (1000 * 60)

        if (diffMinutes > 60) {
            console.log("Error : Delete for everyone time expired.")

            return resp.send({
                success: false,
                msg: "Delete for everyone time expired"
            })

        }
        const myEmail = req.user.email
        const otherUser = chat.users.find(u => u !== myEmail)

        await messageCollection.updateOne({ _id: new ObjectId(msgId) }, {
            $addToSet: { deletedFor: { $each: [myEmail, otherUser] } }
        })

        resp.send({
            success: true,
            msg: "Message deleted for everyone succcessfully!"
        })

    } catch (error) {
        console.log(error.message)
        resp.status(500).send({
            success: false,
            msg: error.message
        })
    }
})
// --------------------------------------------


// Middleware --------------------------------- 
function verifyJWTToken(req, resp, next) {
    const token = req.cookies['token']

    if (!token) {

        return resp.send({
            msg: "User is unauthorised!",
            success: false
        })

    }
    jwt.verify(token, process.env.SECRET_KEY, (error, decoded) => {
        if (error) {
            return resp.send({
                msg: error.message,
                success: false
            })
        }
        req.user = decoded;
        // saves user data
        next()
    })
}
// --------------------------------------------
server.listen(5200, () => console.log("Server is listening"))




