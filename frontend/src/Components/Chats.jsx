import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"
import '../Styles/chatStyle.css'
import { editProfile, logout, loadProfile, searchUser, getFriendList } from "../API";
import { useRef } from "react";
import { format } from "date-fns"
import friends_loader from '../assets/friends_loader.gif'
import friend_dark_loader from "../assets/friend_dark_loader.gif"
import useClickOutSide from "../hooks/useClickOutside";


function Chats({onlineUsers}) {

    const navigate = useNavigate()
    const navigateToChat = useNavigate()
    const [displaySidebar, setDisplaySidebar] = useState(false)
    const inputRef = useRef(null)
    const [foundUser, setFoundUser] = useState(false)
    const [searchedUsers, setSearchedUsers] = useState([])
    const [friendsList, setFriendsList] = useState([])
    const [userImgURL, setUserImgURL] = useState()
    const [loading, setLoading] = useState(false)
    const [darkMode, setDarkMode] = useState(false)
    const displaySidebarRef = useRef(null)



    useClickOutSide(displaySidebarRef,()=>setDisplaySidebar(false))

    // saved themes-------------
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme === "dark") {
            setDarkMode(true)
        }
    }, [])
    // -------------------------


    // fetch all friends of user
    useEffect(() => {

        async function fetchAllFriends() {
            setLoading(true)
            const friends = await getFriendList()
            setFriendsList([...friends])
            setLoading(false)
        }

        fetchAllFriends()

    }, [navigate])

    // check logged in user
    useEffect(() => {
        if (!localStorage.getItem('login')) {
            navigate("/login")
        }
    }, [])
    //--------------

    // load user profile-----------------------------
    useEffect(() => {

        async function loadUserProfile() {
            const data = await loadProfile({ email: localStorage.getItem('login') })
            if (data?.result?.profile_img_url) {
                setUserImgURL(data.result.profile_img_url)
            }
        }
        loadUserProfile()
    }, [])
    // ===============================================

    // logout user====================================
    const handleLogout = async () => {
        // calling backend api to handle logout
        await logout();
        // go to login page
        localStorage.removeItem('login')
        localStorage.removeItem('profile_img_url')
        navigate("/login")
    }
    // ===============================================

    // opens new window for chat=======================
    const handleChat = (user) => {
        navigateToChat(`/chats/${user._id}`)
    }
    // ===============================================

    // handles profile image updation=================
    const handleEditProfile = async (e) => {
        const form = new FormData();
        form.append("profile-image", e.target.files[0])

        const updatedUserData = await editProfile(form);

        if (updatedUserData.success) {
            setUserImgURL(updatedUserData.profile_img_url)
        }
        else {
            console.log(updatedUserData.msg)
        }

    }
    // ===============================================

    // search new user by name =======================
    const handleSearch = async () => {

        const username = inputRef.current.value.trim()
        if (!username) {
            setFoundUser(false)
            return;
        }
        setFoundUser(true)

        const data = await searchUser({ name: username })   //array of users

        setSearchedUsers([...data])

        if (inputRef.current.value === "") {
            setFoundUser(false)
        }


    }
    // ===============================================

    // toggle theme ==================================
    const handleToggle = () => {

        const newTheme = localStorage.getItem("theme") === "dark" ? "light" : "dark";
        localStorage.setItem("theme", newTheme)

        if (newTheme === "dark") {
            document.documentElement.classList.add("dark")
        } else {
            document.documentElement.classList.remove("dark")
        }
        setDarkMode(newTheme === "dark")
    }
    // ===============================================


    return (

        <div className="container">

            {/* navbar */}
            <div className="chat-navbar">
                <div className="chat-app">ChatApp</div>
                <div className="icons">
                    <img className="user-img" src={userImgURL} onClick={() => setDisplaySidebar(prev => !prev)} ></img>
                    <p style={{ "fontSize": "14px", "color": "var(--text-primary)" }}>profile</p>
                </div>
            </div>
            {/* -------------------- */}

            {/* Sidebar ---------------------------*/}
            {displaySidebar && (
                <div ref={displaySidebarRef} className="sidebar">

                    {/* edit profile pic----------- */}
                    <input type="file" id="profile-image" onChange={handleEditProfile} hidden />
                    <label htmlFor="profile-image" className="menus">Edit Profile</label>
                    {/* --------------------------- */}

                    {/* Dark-mode ----------------- */}
                    <div className="menus" onClick={handleToggle}>{darkMode ? "Light Mode ☀️" : "Dark Mode 🌙"}</div>
                    {/* --------------------------- */}

                    {/* logout--------------------- */}
                    <div className="menus" onClick={handleLogout}>logout ⬅</div>
                    {/* ---------------------------- */}

                </div>
            )
            }
            {/* ----------------------------- */}

            {/* search field*/}
            <div className="search">
                <span className="icon">🔍</span>

                <input ref={inputRef} type="text" id="searchUser" placeholder="Search" name="name" onChange={() => { if (!inputRef.current.value.trim()) setFoundUser(false) }} />
                <label htmlFor="searchUser" className="search-icon"  onClick={handleSearch}>⌕</label>
            </div>
            {/* ----------------------------- */}

            {loading && (
                <img src={localStorage.getItem('theme') === "dark" ? friend_dark_loader : friends_loader} className="friend-loader" />
            )}

            {/* chats */}
            {
                foundUser ? (
                    <div className="users-list">
                        {
                            searchedUsers.map((user) => (
                                <div key={user._id} onClick={() => handleChat(user)} className="user">
                                    <img src={user.profile_img_url} className="profile-img"></img>
                                    <div className="friend-list">{user.name}</div>
                                </div>
                            )
                            )
                        }


                    </div>
                ) :
                    (
                        <div className="users-list">
                            {
                                friendsList.map((friend) => (
                                    <div key={friend._id} onClick={() => handleChat(friend)} className="user">

                                        <img src={friend.profile_img_url} className="profile-img"></img>

                                        <div className="friend-list">{friend.name}

                                            {

                                                onlineUsers.includes(friend.email) ? (
                                                    <p className="lastChat">Online</p>
                                                ) : (
                                                    <p className="lastChat">{friend.lastMessage}</p>
                                                )
                                            }

                                        </div>

                                        <div className="last-msg-time">{format(new Date(friend.updatedAt), "dd/MM/yyyy")}</div>

                                    </div>
                                ))
                            }
                        </div>

                    )
            }
            {/* ----------------------------- */}

        </div>

    )
}

export default Chats;




