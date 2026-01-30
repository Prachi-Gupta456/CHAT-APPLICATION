import { useEffect, useState, useRef } from "react"
import EmojiPicker from "emoji-picker-react"
import { useNavigate, NavLink, useParams, useOutletContext, unstable_setDevServerHooks } from "react-router-dom"
import { sendMessage, createChatRoom, deleteMessageForEveryone, deleteChat, findChatId, deleteMessage, getAllMessages, clearAllMessages, getMediaURL, loadProfileById } from "../API";
import { format } from "date-fns"
import socket from "../socket"
import docviewer from "../assets/docviewer.jpg"
import pdfviewer from "../assets/pdfviewer.png"
import send_loader from '../assets/send_loader.webp'
import MediaBubble from "./MediaBubble"
import useAudioRecorder from "../hooks/useAudioRecorder"
import useClickOutside from "../hooks/useClickOutside"
import '../Styles/chatWindowStyle.css'


function ChatWindow() {

    const { onlineUsers } = useOutletContext()
    const { startRecording, stopRecording, recording } = useAudioRecorder()

    const { id } = useParams()

    const navigate = useNavigate()
    const [messageList, setMessageList] = useState([])

    // ----
    const [mediaFiles, setMediaFiles] = useState([])
    // -------

    const [loader, setLoader] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showMoreOptions, setShowMoreOptions] = useState(false)
    const [clearConfirm, setClearConfirm] = useState(false)
    const [deleteChatConfirm, setDeleteChatConfirm] = useState(false)
    const [showDeleteOptions, setShowDeleteOptions] = useState(false)
    const [user, setUser] = useState(null)
    const [chatid, setchatid] = useState(null)
    const [isFriendTyping, setIsFriendTyping] = useState(false)
    const [showFileOptions, setShowFileOptions] = useState(false)
    const [displayProfileImage, setDisplayProfileImage] = useState(false)

    const typingTimeout = useRef(null)
    const messageRef = useRef(null)
    const emojiPickerRef = useRef(null)
    const showMoreOptionsRef = useRef(null)
    const deleteOptionsRef = useRef(null)
    const fileOptionsRef = useRef(null)
    const bottomRef = useRef(null)

    // detect mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // loads friend's data---------------------
    useEffect(() => {
        async function loadfriendData() {
            if (!id) return
            const friendData = await loadProfileById(id)
            setUser(friendData)
        }
        loadfriendData()

    }, [id])
    // -----------------------------------------

    // added typing indicator 
    useEffect(() => {
        const handleTyping = ({ chatId: incomingChatId, typing }) => {
            if (incomingChatId.toString() !== chatid.toString()) {
                return;
            }
            setIsFriendTyping(typing)
        }

        socket.on("typing", handleTyping)

        return () => socket.off("typing", handleTyping)
    }, [chatid])
    // ----------------------------

    // listen for incoming messages--------------------------
    useEffect(() => {
        if (!chatid) return;

        async function handleReceiveMsg(message) {
            if (message.chatId.toString() !== chatid.toString()) return;

            console.log("received msg", message)
            setMessageList(prev => [...prev, message])
        }

        socket.on("receive-message", handleReceiveMsg)

        return () => {
            socket.off("receive-message", handleReceiveMsg)
        }
    }, [chatid])
    // ------------------------------------------------------


    // clicking outside event listener--------------------------
    useClickOutside(emojiPickerRef, () => setShowEmojiPicker(false))
    useClickOutside(showMoreOptionsRef, () => setShowMoreOptions(false))
    useClickOutside(deleteOptionsRef, () => setShowDeleteOptions(false))
    useClickOutside(fileOptionsRef, () => setShowFileOptions(false))
    // ---------------------------------------------------------

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behaviour: "smooth" })
    }, [messageList])

    // loads messages----------------------------------
    useEffect(() => {

        async function loadMessages() {
            if (!user) return
            const chatId = await findChatId({ otherUser: user.email })
            if (!chatId) return
            setchatid(chatId)
            const messages = await getAllMessages(chatId);
            setMessageList(messages);
        }
        loadMessages();
    }, [user]);
    // ------------------------------------------------
    
    // sends message
    const handleSendMessage = async () => {

        setLoader(true) //

        if (mediaFiles.length > 0) {
            await handleMediaFiles();
            setLoader(false) //
            return;
        }

        const text = messageRef.current.value.trim()
        if (text === "") {
            setLoader(false)
            return;
        }

        messageRef.current.value = ""
        const data = {
            otherUser: user.email
        }

        const resp = await createChatRoom(data)
        if (!resp.success) {
            console.log(resp)
            return;
        }
        const chat = resp.chat;

        const msg = {
            chatId: chat._id,
            msgType: "text_msg",
            text: text,
            resourceType: "",
            fileName: "",
            format: ""
        }

        let result = await sendMessage(msg)

        if (!result.success) {
            console.log(resp)
            return;
        }

        result = result.message;

        // real time
        socket.emit("send-msg", { ...result, receiver: user.email })
        // ---------

        setMessageList(prev => [...prev, result])
        setLoader(false)

    }
    
    // handle files----------------
    const handleFile = (e) => {
          
        const files = Array.from(e.target.files);

        if(files.length > 10){
            alert("You can select maximum 10 files at a time.")
            e.target.value = null
            return;
        }

        if (files.length == 0) return;

        // set mediaFiles
        setMediaFiles([...files])

    }
    // ----------------------------

    // handle remove selected file from preview container ==============
    const handleRemoveFile = (selectedFile) => {
        
        const updatedMediaFiles = mediaFiles.filter((file) => file !== selectedFile)
        setMediaFiles(updatedMediaFiles)
    }
    // ===================================================================
  

    // handle mediaFile sending
    const handleMediaFiles = async () => {
        
        // get all media files
        const files = mediaFiles
        const form = new FormData()

        files.forEach(file => {
             form.append("media", file)
        })
       
        setMediaFiles([])

        // generate urls for all media files
        const response = await getMediaURL(form);
        
        // if upload fails
        if (!response.success) {
            alert("Failed to send!")
            return;
        }

        // extract all files url from backend
        const uploadFiles = response.media

        console.log(uploadFiles)

        

        // create chat room or get chat if already exists
         const data = {
            otherUser: user.email
        }
  
        const resp = await createChatRoom(data)

        if (!resp.success) {
            console.log(resp)
            return;
        }
        const chat = resp.chat;

        const allMessages = [];

        for(const file of uploadFiles){
                const { public_id, resource_type, original_name, format } = file

        let type;
        if (file.resource_type === "image") type = "img_msg"
        else if (file.resource_type === "video") type = "vdo_msg"
        else if (file.original_name.endsWith(".pdf")) type = "pdf_msg"
        else if (file.original_name.endsWith(".docx") || file.original_name.endsWith(".doc")) type = "doc_msg"

        // let resourceType = resource_type
  
        //    if (type === "pdf_msg" || type === "doc_msg") {
        //     resourceType = "raw"
        // }

 //  sending message
        const msg = {
            chatId: chat._id,
            msgType: type,
            text: public_id,
            resourceType: resource_type,
            fileName: original_name,
            format
        }
        // -------------

           let result = await sendMessage(msg)
        if (!result.success) {
            console.log(resp)
            continue;
        }

        result = result.message;

        // store every message into allMessages list
        allMessages.push(result)
       
        }

     
       
        // real time
        socket.emit("send-msg", { ...allMessages, receiver: user.email })
        // ---------


        setMessageList(prev => [...prev,...allMessages])
    }
    // ------------------

    // handle voice message----------
    const handleVoiceMessage = async (audioBlob) => {
        const file = new File([audioBlob], "voice-message.webm", { type: "audio/webm" })

        const form = new FormData()
        form.append("media", file)

        const response = await getMediaURL(form)

        if (!response.success) {
            alert("Failed to send!")
            return;
        }

        const { public_id, resource_type } = response.media

        const data = {
            otherUser: user.email
        }

        const resp = await createChatRoom(data)

        if (!resp.success) {
            console.log(resp)
            return;
        }

        const chat = resp.chat;

        //  sending
        const msg = {
            chatId: chat._id,
            msgType: "voice_msg",
            text: public_id,
            resourceType: resource_type,
            fileName: "voice message"
        }
        // -------------

        let result = await sendMessage(msg)
        if (!result.success) {
            console.log(resp)
            return;
        }

        result = result.message

        // ----------------
        // real time
        socket.emit("send-msg", { ...result, receiver: user.email })
        // ---------

        setMessageList(prev => [...prev, result])
    }

    const handleEmojiClick = (emojiData) => {
        messageRef.current.value += emojiData.emoji
        messageRef.current.focus()
    }

    // clear all messages of a chat ====================
    const handleClearChat = async () => {
        const chatId = await findChatId({ otherUser: user.email })
        const result = await clearAllMessages(chatId)
        if (result.success) {
            alert("Messages Deleted Successfully!")
            setMessageList([])
            setShowMoreOptions(false)
        }
        else {
            alert("Failed to delete.Try after some time!")
        }
    }
    // =================================================

    // delete a particular msg of a chat from me========
    const handleDeleteMesssage = async (message) => {

        // message which has  already deleted from database
        if (message.msgType === "deleted_msg") {
            setMessageList(prev => prev.filter(msg => msg._id !== message._id))
            return;
        }

        const result = await deleteMessage(message._id)
        if (result?.success) {
            //    refresh message list
            setMessageList(prev =>
                prev.map(msg =>
                    msg._id === message._id ? {
                        ...msg,
                        msgType: "deleted_msg",
                        text: "This message was deleted"
                    } :
                        msg
                ))
        }
        else {
            alert("Failed to delete.Try after some time!")
        }
        setShowDeleteOptions(null)
    }
    // =================================================

    // delete a particular msg of a chat for everyone =====
    const handleDeleteMesssageForEveryone = async (message) => {

        // message which has  already deleted from database
        if (message.msgType === "deleted_msg") {
            setMessageList(prev => prev.filter(msg => msg._id !== message._id))
            return;
        }

        const result = await deleteMessageForEveryone(
            {
                msgId: message._id,
                createdAt: message.createdAt,
                chatId: message.chatId
            })
        if (result?.success) {
            //    refresh message list
            alert("message deleted")
            setMessageList(prev =>
                prev.map(msg =>
                    msg._id === message._id ? {
                        ...msg,
                        msgType: "deleted_msg",
                        text: "This message was deleted for everyone"
                    } :
                        msg
                ))
        }
        else {
            alert("Failed to delete.Try after some time!")
        }
        setShowDeleteOptions(null)
    }
    // =================================================


    // delete chat ------------------------------------
    const handleDeleteChat = async () => {
        const chatId = await findChatId({ otherUser: user.email })

        if (!chatId) {
            alert("Chat does not exist yet!")
            return;
        }

        const result = await deleteChat(chatId)

        if (result?.success) {
            alert("Chat deleted successfully!")
            setMessageList([])

            // --------------
            setchatid(null)
            // --------------
            navigate("/chats")

        } else {
            alert("Try after some time!")
        }
    }
    // ================================================

    // handle typing-----------------------------------
    const handleTyping = () => {
        socket.emit("typing-start", {
            receiver: user.email,
            chatId: chatid
        })

        clearTimeout(typingTimeout.current)

        typingTimeout.current = setTimeout(() => {
            socket.emit("typing-stop", {
                receiver: user.email,
                chatId: chatid
            })
        }, 1500)
    }
    // ------------------------------------------------

    return (
        <div className="chat-wrapper">

            {/* navbar */}
            <div className="navbar">

                {/* user-info */}
                <div className="user-info">

                    <NavLink to="/chats" className="back-btn">←</NavLink>
                    {user && (
                        <>  
                            <div className="clickable-pic"  onClick={() => setDisplayProfileImage(prev => !prev)}>
                            <img className="profile-img" src={user?.profile_img_url} ></img>
                            </div>

                            <div className="user-name">{user?.name}

                                {

                                    onlineUsers.includes(user.email) ? (

                                        isFriendTyping ?
                                            (<p className="typing">typing...</p>) :
                                            (<p className="status">Online</p>)

                                    ) : (
                                        <p className="status">last seen : {user.lastSeen ? format(new Date(user.lastSeen), "hh:mm a") : "__"}</p>
                                    )
                                }

                            </div>

                        </>
                    )
                    }
                </div>
                {/* ---------------- */}

                {/* more options box */}
                <div className="options">
                    <div onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreOptions(prev => !prev)
                    }
                    }>⋮</div>
                </div>
                {/* -------------------- */}
            </div>
            {/* --------------- */}
             
             {/* clear chat confirmation box */}
            {
                clearConfirm &&
                (
                    <div className="deletion-confirm-box">
                        <div>Are you sure you want to delete ?</div>
                        <div className="choice-btns">

                            <button onClick={() => setClearConfirm(false)}>Cancel</button>
                            <button className="deleteBtn" onClick={() => {
                                setClearConfirm(false)
                                handleClearChat()
                            }}>Delete</button>

                        </div>
                    </div>
                )
            }
            {/* ----------------------------- */}
           
           {/* delete chat confirmation box-- */}
            {
                deleteChatConfirm &&
                (
                    <div className="deletion-confirm-box">
                        <div>Are you sure you want to delete Chat ?</div>
                        <div className="choice-btns">

                            <button onClick={() => setDeleteChatConfirm(false)}>Cancel</button>
                            <button className="deleteBtn" onClick={() => {
                                setDeleteChatConfirm(false)
                                handleDeleteChat()
                            }}>Delete</button>

                        </div>
                    </div>
                )
            }
            {/* ----------------------------- */}

            {/* more options box */}
            {showMoreOptions && (
                <div ref={showMoreOptionsRef} className="show-options">
                    <div onClick={() => setClearConfirm(true)} className="clear-chat-box">❌ Clear chat</div>
                    <div onClick={() => setDeleteChatConfirm(true)} className="remove-chat">🗑️ Delete chat</div>
                </div>
            )
            }
            {/* ----------------- */}

            {/* message-area */}
            <div className="msg-area">

                {
                    messageList.map(
                        (msg) => {
                            const isMe = msg.sender === localStorage.getItem('login')
                            return (
                                <div key={msg._id} className={isMe ? "my-text-box" : "friend-text-box"}>

                                    {
                                        msg.msgType === "deleted_msg" ? (
                                            <i className="deleted_msg">🚫 {msg.text}</i>

                                        ) : msg.msgType === "text_msg" ? (
                                            msg.text

                                        ) : msg.msgType === "img_msg" ? (
                                            <img src={`https://res.cloudinary.com/${import.meta.env.VITE_CLOUD_NAME}/image/upload/${msg.text}`} />
                                        ) :
                                            msg.msgType === "vdo_msg" ? (
                                                <video src={`https://res.cloudinary.com/${import.meta.env.VITE_CLOUD_NAME}/video/upload/${msg.text}`} controls />
                                            ) :
                                                msg.msgType === "pdf_msg" || msg.msgType === "doc_msg" ?
                                                    (

                                                        <div className="file-section">

                                                            <div className="file-info">
                                                                <img id="file-img" src={msg.msgType === "pdf_msg" ? pdfviewer : docviewer} />
                                                                <p>{msg.fileName}</p>
                                                            </div>
                                                            <hr />

                                                            <div className="link-tags">
                                                                <a href={`${import.meta.env.VITE_API_URL}/download/${msg._id}`} rel="noopener noreferrer">Save As</a>
                                                                {/* {msg.msgType === "pdf_msg" && <a href={`${import.meta.env.VITE_API_URL}/preview/${msg._id}`}>Open</a>} */}
                                                            </div>

                                                        </div>

                                                    ) :
                                                    msg.msgType === "voice_msg" ?
                                                        (
                                                            <div className="audio-wrapper">

                                                                <audio controls>
                                                                    <source src={`https://res.cloudinary.com/${import.meta.env.VITE_CLOUD_NAME}/video/upload/${msg.text}`}
                                                                        type="audio/webm" />
                                                                </audio>

                                                            </div>
                                                        ) :
                                                        null
                                    }

                                    <div className={`text-time ${isMe ? "my-time" : "friends-time"}`}>{format(new Date(msg.createdAt), "dd MMM yyyy, hh:mm a")}
                                        <div onClick={(e) => { e.stopPropagation(); setShowDeleteOptions(showDeleteOptions === msg._id ? null : msg._id) }} className="delete-icon">▾</div>
                                    </div>

                                    {/* show delete options */}
                                    {showDeleteOptions === msg._id && (
                                        // <div className="show-delete-options" >
                                        <div ref={deleteOptionsRef} className={`show-delete-options ${isMe ? "me" : "friend"}`}>
                                            <div onClick={() => handleDeleteMesssage(msg)} className="delete-btns">Delete For Me</div>
                                            <div onClick={() => handleDeleteMesssageForEveryone(msg)} className="delete-btns">Delete For Everyone</div>
                                        </div>
                                    )
                                    }
                                    {/* --------------- */}
                                </div>
                            )
                        }
                    )
                }

                {/* auto scroll target */}
                <div ref={bottomRef}></div>
                {/* ------------------- */}
            </div>


            {/* Media files preview container ------------- */}
            {
                mediaFiles.length > 0 && (

                    <div className="preview-container">
                      
                      {
                      mediaFiles.map( (mediaFile,index) => (

                         <div key={index} className="media-file-wrapper">
                        <div className="cancel-icon" onClick={() => handleRemoveFile(mediaFile)}>❌</div>
                        <MediaBubble file={mediaFile} />
                        </div>

                      ) )
                    }      
                    </div>
                    ) 
            }
            {/* ----------------------------- */}

            {/*---------------------- loader ------------------------------ */}
            {loader && <img className="send-loader" src={send_loader} />}
            {/* ----------------------------------------------------------- */}


            {/* input field for sending message */}
            <div className="msg-container">

                {/* emoji picker ----------------------------------------------------*/}
                <div className="emoji-icon" onClick={() => {
                    if (isMobile) {
                        messageRef.current.focus()
                    } else {
                        setShowEmojiPicker(prev => !prev)
                    }
                }}>

                </div>
                {/* ---------------------------------------------------------------------- */}
        
                {!isMobile && showEmojiPicker && (
                    <div className="emoji-picker" ref={emojiPickerRef}>
                        <EmojiPicker onEmojiClick={handleEmojiClick}></EmojiPicker>
                    </div>
                )
                }

                {/* textarea---------------------------- */}
                <textarea ref={messageRef} className="msg" placeholder="Type a message" onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendMessage()

                        socket.emit("typing-stop", {
                            receiver: user.email,
                            chatId: chatid
                        })
                    }
                }
                }
                    onChange={handleTyping} />
                {/* ------------------------------------ */}


                {/* attach icon--------------------------------------------------- */}
                <div className="attach-icon" onClick={() => setShowFileOptions(prev => !prev)}>📎</div>
                <div className="send-img" onClick={handleSendMessage}></div>
            </div>
            {/* ------------------------------------------------- */}

            {/* file-box */}
            {showFileOptions && (
                <div ref={fileOptionsRef} className="file-options-box">


                    <div className="wrap-options">

                        <input type="file" id="file-input" onChange={handleFile} multiple  hidden/>
                        <label htmlFor="file-input" className="menus">
                            <span className="file-attach-icons">📸</span>
                            Photos and Videos</label>

                    </div>

                    <div className="wrap-options">
                        <div className="menus" onMouseDown={startRecording} onMouseUp={async () => {
                            const audioBlob = await stopRecording()
                            handleVoiceMessage(audioBlob)
                        }}><span className="file-attach-icons">{recording ? "🎙️" : "🎤"}</span>
                            {recording ? "Recording" : "Voice Message"}</div>

                    </div>

                    <div className="wrap-options">

                        <input type="file" id="file-input" onChange={handleFile} hidden />
                        <label htmlFor="file-input" className="menus">
                            <span className="file-attach-icons">📁</span>
                            Documents</label>

                    </div>

                </div>
            )}
            {/* ------------ */}

            {/* display profile image */}
            {displayProfileImage && user && (
                <div className="show-profile-image">
                    <img alt="profile-image" src={user?.profile_img_url} />
                    <p>{user?.name}</p>

                </div>
            )
            }
            {/* --------------------- */}


        </div>
    )
}

export default ChatWindow;





// import { useEffect, useState, useRef } from "react"
// import EmojiPicker from "emoji-picker-react"
// import { useNavigate, NavLink, useParams, useOutletContext, unstable_setDevServerHooks } from "react-router-dom"
// import { sendMessage, createChatRoom, deleteMessageForEveryone, deleteChat, findChatId, deleteMessage, getAllMessages, clearAllMessages, getMediaURL, loadProfileById } from "../API";
// import { format } from "date-fns"
// import socket from "../socket"
// import docviewer from "../assets/docviewer.jpg"
// import pdfviewer from "../assets/pdfviewer.png"
// import send_loader from '../assets/send_loader.webp'
// import MediaBubble from "./MediaBubble"
// import useAudioRecorder from "../hooks/useAudioRecorder"
// import useClickOutside from "../hooks/useClickOutside"
// import '../Styles/chatWindowStyle.css'


// function ChatWindow() {

//     const { onlineUsers } = useOutletContext()
//     const { startRecording, stopRecording, recording } = useAudioRecorder()

//     const { id } = useParams()

//     const navigate = useNavigate()
//     const [messageList, setMessageList] = useState([])

//     // ----
//     const [mediaFiles, setMediaFiles] = useState([])
//     // -------
    
//     const [loader, setLoader] = useState(false)
//     const [showEmojiPicker, setShowEmojiPicker] = useState(false)
//     const [showMoreOptions, setShowMoreOptions] = useState(false)
//     const [clearConfirm, setClearConfirm] = useState(false)
//     const [deleteChatConfirm, setDeleteChatConfirm] = useState(false)
//     const [showDeleteOptions, setShowDeleteOptions] = useState(false)
//     const [user, setUser] = useState(null)
//     const [chatid, setchatid] = useState(null)
//     const [isFriendTyping, setIsFriendTyping] = useState(false)
//     const [showFileOptions, setShowFileOptions] = useState(false)
//     const [displayProfileImage, setDisplayProfileImage] = useState(false)

//     const typingTimeout = useRef(null)
//     const messageRef = useRef(null)
//     const emojiPickerRef = useRef(null)
//     const showMoreOptionsRef = useRef(null)
//     const deleteOptionsRef = useRef(null)
//     const fileOptionsRef = useRef(null)
//     const bottomRef = useRef(null)

//     // detect mobile
//     const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

//     // loads friend's data---------------------
//     useEffect(() => {
//         async function loadfriendData() {
//             if (!id) return
//             const friendData = await loadProfileById(id)
//             setUser(friendData)
//         }
//         loadfriendData()

//     }, [id])
//     // -----------------------------------------

//     // added typing indicator 
//     useEffect(() => {
//         const handleTyping = ({ chatId: incomingChatId, typing }) => {
//             if (incomingChatId.toString() !== chatid.toString()) {
//                 return;
//             }
//             setIsFriendTyping(typing)
//         }

//         socket.on("typing", handleTyping)

//         return () => socket.off("typing", handleTyping)
//     }, [chatid])
//     // ----------------------------

//     // listen for incoming messages--------------------------
//     useEffect(() => {
//         if (!chatid) return;

//         async function handleReceiveMsg(message) {
//             if (message.chatId.toString() !== chatid.toString()) return;

//             console.log("received msg", message)
//             setMessageList(prev => [...prev, message])
//         }

//         socket.on("receive-message", handleReceiveMsg)

//         return () => {
//             socket.off("receive-message", handleReceiveMsg)
//         }
//     }, [chatid])
//     // ------------------------------------------------------


//     // clicking outside event listener--------------------------
//     useClickOutside(emojiPickerRef, () => setShowEmojiPicker(false))
//     useClickOutside(showMoreOptionsRef, () => setShowMoreOptions(false))
//     useClickOutside(deleteOptionsRef, () => setShowDeleteOptions(false))
//     useClickOutside(fileOptionsRef, () => setShowFileOptions(false))
//     // ---------------------------------------------------------

//     useEffect(() => {
//         bottomRef.current?.scrollIntoView({ behaviour: "smooth" })
//     }, [messageList])

//     // loads messages----------------------------------
//     useEffect(() => {

//         async function loadMessages() {
//             if (!user) return
//             const chatId = await findChatId({ otherUser: user.email })
//             if (!chatId) return
//             setchatid(chatId)
//             const messages = await getAllMessages(chatId);
//             setMessageList(messages);
//         }
//         loadMessages();
//     }, [user]);
//     // ------------------------------------------------
    
//     // sends message
//     const handleSendMessage = async () => {

//         setLoader(true) //

//         if (mediaFile) {
//             await handleMediaFile();
//             setLoader(false) //
//             return;
//         }

//         const text = messageRef.current.value.trim()
//         if (text === "") {
//             setLoader(false)
//             return;
//         }

//         messageRef.current.value = ""
//         const data = {
//             otherUser: user.email
//         }

//         const resp = await createChatRoom(data)
//         if (!resp.success) {
//             console.log(resp)
//             return;
//         }
//         const chat = resp.chat;

//         const msg = {
//             chatId: chat._id,
//             msgType: "text_msg",
//             text: text,
//             resourceType: "",
//             fileName: "",
//             format: ""
//         }

//         let result = await sendMessage(msg)

//         if (!result.success) {
//             console.log(resp)
//             return;
//         }

//         result = result.message;

//         // real time
//         socket.emit("send-msg", { ...result, receiver: user.email })
//         // ---------

//         setMessageList(prev => [...prev, result])
//         setLoader(false)

//     }
    
//     // handles file------
//     const handleFile = (e) => {
          
//         const file = e.target.files[0];
//         if (!file) return;
//         setMediaFile(file)

//         // const files = e.target.files;
//         // console.log(files)

//     }

//     const handleMediaFile = async () => {

//         const file = mediaFile
//         const form = new FormData()
//         form.append("media", mediaFile)

//         setMediaFile(null)

//         const response = await getMediaURL(form);

//         if (!response.success) {
//             alert("Failed to send!")
//             return;
//         }

//         const { public_id, resource_type, original_name, format } = response.media

//         const data = {
//             otherUser: user.email
//         }

//         const resp = await createChatRoom(data)

//         if (!resp.success) {
//             console.log(resp)
//             return;
//         }

//         const chat = resp.chat;

//         let type;

//         if (file.type.startsWith("image/")) type = "img_msg"
//         else if (file.type.startsWith("video/")) type = "vdo_msg"
//         else if (file.name.endsWith(".pdf")) type = "pdf_msg"
//         else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) type = "doc_msg"

//         let resourceType = resource_type

//         if (type === "pdf_msg" || type === "doc_msg") {
//             resourceType = "raw"
//         }

//         //  sending
//         const msg = {
//             chatId: chat._id,
//             msgType: type,
//             text: public_id,
//             resourceType: resourceType,
//             fileName: original_name,
//             format
//         }
//         // -------------

//         let result = await sendMessage(msg)
//         if (!result.success) {
//             console.log(resp)
//             return;
//         }

//         result = result.message;

//         // ----------------
//         // real time
//         socket.emit("send-msg", { ...result, receiver: user.email })
//         // ---------


//         setMessageList(prev => [...prev, result])


//     }
//     // ------------------

//     // handle voice message----------
//     const handleVoiceMessage = async (audioBlob) => {
//         const file = new File([audioBlob], "voice-message.webm", { type: "audio/webm" })

//         const form = new FormData()
//         form.append("media", file)

//         const response = await getMediaURL(form)

//         if (!response.success) {
//             alert("Failed to send!")
//             return;
//         }

//         const { public_id, resource_type } = response.media

//         const data = {
//             otherUser: user.email
//         }

//         const resp = await createChatRoom(data)

//         if (!resp.success) {
//             console.log(resp)
//             return;
//         }

//         const chat = resp.chat;

//         //  sending
//         const msg = {
//             chatId: chat._id,
//             msgType: "voice_msg",
//             text: public_id,
//             resourceType: resource_type,
//             fileName: "voice message"
//         }
//         // -------------

//         let result = await sendMessage(msg)
//         if (!result.success) {
//             console.log(resp)
//             return;
//         }

//         result = result.message

//         // ----------------
//         // real time
//         socket.emit("send-msg", { ...result, receiver: user.email })
//         // ---------

//         setMessageList(prev => [...prev, result])
//     }

//     const handleEmojiClick = (emojiData) => {
//         messageRef.current.value += emojiData.emoji
//         messageRef.current.focus()
//     }

//     // clear all messages of a chat ====================
//     const handleClearChat = async () => {
//         const chatId = await findChatId({ otherUser: user.email })
//         const result = await clearAllMessages(chatId)
//         if (result.success) {
//             alert("Messages Deleted Successfully!")
//             setMessageList([])
//             setShowMoreOptions(false)
//         }
//         else {
//             alert("Failed to delete.Try after some time!")
//         }
//     }
//     // =================================================

//     // delete a particular msg of a chat from me========
//     const handleDeleteMesssage = async (message) => {

//         // message which has  already deleted from database
//         if (message.msgType === "deleted_msg") {
//             setMessageList(prev => prev.filter(msg => msg._id !== message._id))
//             return;
//         }

//         const result = await deleteMessage(message._id)
//         if (result?.success) {
//             //    refresh message list
//             setMessageList(prev =>
//                 prev.map(msg =>
//                     msg._id === message._id ? {
//                         ...msg,
//                         msgType: "deleted_msg",
//                         text: "This message was deleted"
//                     } :
//                         msg
//                 ))
//         }
//         else {
//             alert("Failed to delete.Try after some time!")
//         }
//         setShowDeleteOptions(null)
//     }
//     // =================================================

//     // delete a particular msg of a chat for everyone =====
//     const handleDeleteMesssageForEveryone = async (message) => {

//         // message which has  already deleted from database
//         if (message.msgType === "deleted_msg") {
//             setMessageList(prev => prev.filter(msg => msg._id !== message._id))
//             return;
//         }

//         const result = await deleteMessageForEveryone(
//             {
//                 msgId: message._id,
//                 createdAt: message.createdAt,
//                 chatId: message.chatId
//             })
//         if (result?.success) {
//             //    refresh message list
//             alert("message deleted")
//             setMessageList(prev =>
//                 prev.map(msg =>
//                     msg._id === message._id ? {
//                         ...msg,
//                         msgType: "deleted_msg",
//                         text: "This message was deleted for everyone"
//                     } :
//                         msg
//                 ))
//         }
//         else {
//             alert("Failed to delete.Try after some time!")
//         }
//         setShowDeleteOptions(null)
//     }
//     // =================================================


//     // delete chat ------------------------------------
//     const handleDeleteChat = async () => {
//         const chatId = await findChatId({ otherUser: user.email })

//         if (!chatId) {
//             alert("Chat does not exist yet!")
//             return;
//         }

//         const result = await deleteChat(chatId)

//         if (result?.success) {
//             alert("Chat deleted successfully!")
//             setMessageList([])

//             // --------------
//             setchatid(null)
//             // --------------
//             navigate("/chats")

//         } else {
//             alert("Try after some time!")
//         }
//     }
//     // ================================================

//     // handle typing-----------------------------------
//     const handleTyping = () => {
//         socket.emit("typing-start", {
//             receiver: user.email,
//             chatId: chatid
//         })

//         clearTimeout(typingTimeout.current)

//         typingTimeout.current = setTimeout(() => {
//             socket.emit("typing-stop", {
//                 receiver: user.email,
//                 chatId: chatid
//             })
//         }, 1500)
//     }
//     // ------------------------------------------------

//     return (
//         <div className="chat-wrapper">

//             {/* navbar */}
//             <div className="navbar">

//                 {/* user-info */}
//                 <div className="user-info">

//                     <NavLink to="/chats" className="back-btn">←</NavLink>
//                     {user && (
//                         <>  
//                             <div className="clickable-pic"  onClick={() => setDisplayProfileImage(prev => !prev)}>
//                             <img className="profile-img" src={user?.profile_img_url} ></img>
//                             </div>

//                             <div className="user-name">{user?.name}

//                                 {

//                                     onlineUsers.includes(user.email) ? (

//                                         isFriendTyping ?
//                                             (<p className="typing">typing...</p>) :
//                                             (<p className="status">Online</p>)

//                                     ) : (
//                                         <p className="status">last seen : {user.lastSeen ? format(new Date(user.lastSeen), "hh:mm a") : "__"}</p>
//                                     )
//                                 }

//                             </div>

//                         </>
//                     )
//                     }
//                 </div>
//                 {/* ---------------- */}

//                 {/* more options box */}
//                 <div className="options">
//                     <div onClick={(e) => {
//                         e.stopPropagation();
//                         setShowMoreOptions(prev => !prev)
//                     }
//                     }>⋮</div>
//                 </div>
//                 {/* -------------------- */}
//             </div>
//             {/* --------------- */}
             
//              {/* clear chat confirmation box */}
//             {
//                 clearConfirm &&
//                 (
//                     <div className="deletion-confirm-box">
//                         <div>Are you sure you want to delete ?</div>
//                         <div className="choice-btns">

//                             <button onClick={() => setClearConfirm(false)}>Cancel</button>
//                             <button className="deleteBtn" onClick={() => {
//                                 setClearConfirm(false)
//                                 handleClearChat()
//                             }}>Delete</button>

//                         </div>
//                     </div>
//                 )
//             }
//             {/* ----------------------------- */}
           
//            {/* delete chat confirmation box-- */}
//             {
//                 deleteChatConfirm &&
//                 (
//                     <div className="deletion-confirm-box">
//                         <div>Are you sure you want to delete Chat ?</div>
//                         <div className="choice-btns">

//                             <button onClick={() => setDeleteChatConfirm(false)}>Cancel</button>
//                             <button className="deleteBtn" onClick={() => {
//                                 setDeleteChatConfirm(false)
//                                 handleDeleteChat()
//                             }}>Delete</button>

//                         </div>
//                     </div>
//                 )
//             }
//             {/* ----------------------------- */}

//             {/* more options box */}
//             {showMoreOptions && (
//                 <div ref={showMoreOptionsRef} className="show-options">
//                     <div onClick={() => setClearConfirm(true)} className="clear-chat-box">❌ Clear chat</div>
//                     <div onClick={() => setDeleteChatConfirm(true)} className="remove-chat">🗑️ Delete chat</div>
//                 </div>
//             )
//             }
//             {/* ----------------- */}

//             {/* message-area */}
//             <div className="msg-area">

//                 {
//                     messageList.map(
//                         (msg) => {
//                             const isMe = msg.sender === localStorage.getItem('login')
//                             return (
//                                 <div key={msg._id} className={isMe ? "my-text-box" : "friend-text-box"}>

//                                     {
//                                         msg.msgType === "deleted_msg" ? (
//                                             <i className="deleted_msg">🚫 {msg.text}</i>

//                                         ) : msg.msgType === "text_msg" ? (
//                                             msg.text

//                                         ) : msg.msgType === "img_msg" ? (
//                                             <img src={`https://res.cloudinary.com/${import.meta.env.VITE_CLOUD_NAME}/image/upload/${msg.text}`} />
//                                         ) :
//                                             msg.msgType === "vdo_msg" ? (
//                                                 <video src={`https://res.cloudinary.com/${import.meta.env.VITE_CLOUD_NAME}/video/upload/${msg.text}`} controls />
//                                             ) :
//                                                 msg.msgType === "pdf_msg" || msg.msgType === "doc_msg" ?
//                                                     (

//                                                         <div className="file-section">

//                                                             <div className="file-info">
//                                                                 <img id="file-img" src={msg.msgType === "pdf_msg" ? pdfviewer : docviewer} />
//                                                                 <p>{msg.fileName}</p>
//                                                             </div>
//                                                             <hr />

//                                                             <div className="link-tags">
//                                                                 <a href={`${import.meta.env.VITE_API_URL}/download/${msg._id}`} rel="noopener noreferrer">Save As</a>
//                                                                 {/* {msg.msgType === "pdf_msg" && <a href={`${import.meta.env.VITE_API_URL}/preview/${msg._id}`}>Open</a>} */}
//                                                             </div>

//                                                         </div>

//                                                     ) :
//                                                     msg.msgType === "voice_msg" ?
//                                                         (
//                                                             <div className="audio-wrapper">

//                                                                 <audio controls>
//                                                                     <source src={`https://res.cloudinary.com/${import.meta.env.VITE_CLOUD_NAME}/video/upload/${msg.text}`}
//                                                                         type="audio/webm" />
//                                                                 </audio>

//                                                             </div>
//                                                         ) :
//                                                         null
//                                     }

//                                     <div className={`text-time ${isMe ? "my-time" : "friends-time"}`}>{format(new Date(msg.createdAt), "dd MMM yyyy, hh:mm a")}
//                                         <div onClick={(e) => { e.stopPropagation(); setShowDeleteOptions(showDeleteOptions === msg._id ? null : msg._id) }} className="delete-icon">▾</div>
//                                     </div>

//                                     {/* show delete options */}
//                                     {showDeleteOptions === msg._id && (
//                                         // <div className="show-delete-options" >
//                                         <div ref={deleteOptionsRef} className={`show-delete-options ${isMe ? "me" : "friend"}`}>
//                                             <div onClick={() => handleDeleteMesssage(msg)} className="delete-btns">Delete For Me</div>
//                                             <div onClick={() => handleDeleteMesssageForEveryone(msg)} className="delete-btns">Delete For Everyone</div>
//                                         </div>
//                                     )
//                                     }
//                                     {/* --------------- */}
//                                 </div>
//                             )
//                         }
//                     )
//                 }

//                 {/* auto scroll target */}
//                 <div ref={bottomRef}></div>
//                 {/* ------------------- */}
//             </div>


//             {/* Media file preview container ------------- */}
//             {
//                 mediaFile ? (

//                     <div className="preview-container">
                      
                      
//                         <div className="media-file-wrapper">
//                         <div className="cancel-icon" onClick={() => setMediaFile(null)}>❌</div>
//                         <MediaBubble file={mediaFile} />
//                         </div>


//                     </div>

//                 ) : null
//             }
//             {/* ----------------------------- */}

//             {/*---------------------- loader ------------------------------ */}
//             {loader && <img className="send-loader" src={send_loader} />}
//             {/* ----------------------------------------------------------- */}


//             {/* input field for sending message */}
//             <div className="msg-container">

//                 {/* emoji picker ----------------------------------------------------*/}
//                 <div className="emoji-icon" onClick={() => {
//                     if (isMobile) {
//                         messageRef.current.focus()
//                     } else {
//                         setShowEmojiPicker(prev => !prev)
//                     }
//                 }}>

//                 </div>
//                 {/* ---------------------------------------------------------------------- */}
        
//                 {!isMobile && showEmojiPicker && (
//                     <div className="emoji-picker" ref={emojiPickerRef}>
//                         <EmojiPicker onEmojiClick={handleEmojiClick}></EmojiPicker>
//                     </div>
//                 )
//                 }

//                 {/* textarea---------------------------- */}
//                 <textarea ref={messageRef} className="msg" placeholder="Type a message" onKeyDown={(e) => {
//                     if (e.key === "Enter") {
//                         e.preventDefault();
//                         handleSendMessage()

//                         socket.emit("typing-stop", {
//                             receiver: user.email,
//                             chatId: chatid
//                         })
//                     }
//                 }
//                 }
//                     onChange={handleTyping} />
//                 {/* ------------------------------------ */}


//                 {/* attach icon--------------------------------------------------- */}
//                 <div className="attach-icon" onClick={() => setShowFileOptions(prev => !prev)}>📎</div>
//                 <div className="send-img" onClick={handleSendMessage}></div>
//             </div>
//             {/* ------------------------------------------------- */}

//             {/* file-box */}
//             {showFileOptions && (
//                 <div ref={fileOptionsRef} className="file-options-box">


//                     <div className="wrap-options">

//                         <input type="file" id="file-input" onChange={handleFile}   hidden/>
//                         <label htmlFor="file-input" className="menus">
//                             <span className="file-attach-icons">📸</span>
//                             Photos and Videos</label>

//                     </div>

//                     <div className="wrap-options">
//                         <div className="menus" onMouseDown={startRecording} onMouseUp={async () => {
//                             const audioBlob = await stopRecording()
//                             handleVoiceMessage(audioBlob)
//                         }}><span className="file-attach-icons">{recording ? "🎙️" : "🎤"}</span>
//                             {recording ? "Recording" : "Voice Message"}</div>

//                     </div>

//                     <div className="wrap-options">

//                         <input type="file" id="file-input" onChange={handleFile} hidden />
//                         <label htmlFor="file-input" className="menus">
//                             <span className="file-attach-icons">📁</span>
//                             Documents</label>

//                     </div>

//                 </div>
//             )}
//             {/* ------------ */}

//             {/* display profile image */}
//             {displayProfileImage && user && (
//                 <div className="show-profile-image">
//                     <img alt="profile-image" src={user?.profile_img_url} />
//                     <p>{user?.name}</p>

//                 </div>
//             )
//             }
//             {/* --------------------- */}


//         </div>
//     )
// }


