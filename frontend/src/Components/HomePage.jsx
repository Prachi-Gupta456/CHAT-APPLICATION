import React from "react";
import '../Styles/homePage.css'
import { useNavigate } from "react-router-dom";
import chat_bot from '../assets/chat_bot.gif'


function HomePage() {

    const navigate = useNavigate()

    return (
        <div className="homepage-container">

            <div className="wrapper">
                <img src={chat_bot} className="chat-bot-img"></img>
                <div className="heading">WELCOME TO CHAT APP</div>
                <button className="continue-btn" onClick={() => navigate('/signup')}>Create an account</button>
            </div>
            
        </div>
    )
}

export default HomePage;