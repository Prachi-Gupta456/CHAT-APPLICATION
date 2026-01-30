
import { Routes, Route } from "react-router-dom"
import './App.css'
import SignUp from './Components/SignUp'
import Login from './Components/Login'
import ChatWindow from './Components/ChatWindow'
import Protected from './Components/Protected'
import HomePage from './Components/HomePage'
import ChatLayout from './Components/ChatLayout'
import socket from './socket'
import { useEffect } from 'react'

function App() {

  useEffect(() => {
    const email = localStorage.getItem("login");
    if (!email) return;

    socket.auth = {email}
    socket.connect();
     
    return () => {
      socket.disconnect()
    };
  }, [])

        useEffect(() => {
        const savedTheme = localStorage.getItem("theme") || "light"
        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark")
        }else{
          document.documentElement.classList.remove("dark")
        }
    }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chats" element={<Protected><ChatLayout /></Protected>}>
          <Route path=":id" element={<ChatWindow />} />
        </Route>

      </Routes>
    </>
  )
}

export default App
