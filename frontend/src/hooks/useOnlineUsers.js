import { useEffect, useState } from "react";
import socket from "../socket";

export default function useOnlineUsers() {
    const [onlineUsers,setOnlineUsers] = useState([])

    useEffect(() => {

        const handleOnlineUsers = (users) => {
            setOnlineUsers(users)
        }
        socket.on("online-users",handleOnlineUsers)

        return () => socket.off("online-users",handleOnlineUsers)
    },[])

    console.log(onlineUsers)

    return onlineUsers;
}