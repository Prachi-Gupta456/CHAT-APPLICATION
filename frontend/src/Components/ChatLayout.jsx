import { Outlet,useParams } from "react-router-dom"
import useOnlineUsers from "../hooks/useOnlineUsers"
import Chats from './Chats'
import '../Styles/chatLayout.css'

function ChatLayout(){
    const {id} = useParams()
    const onlineUsers = useOnlineUsers()

    return(
        <div className="chat-layout">
            <div className={`chat-list ${id ? "hide-mobile":""}`}>
            <Chats onlineUsers={onlineUsers}/>
            </div>

             <div className={`chat-window ${id ? "show":"start-chat"}`}>
            <Outlet context={{onlineUsers}}/>
            </div>

        </div>

    )
}

export default ChatLayout