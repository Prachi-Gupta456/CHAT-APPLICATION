import axios from "axios"

const URL = `${import.meta.env.VITE_API_URL}`

export const signup = async (data) => {
    try {
        const resp = await axios.post(`${URL}/signUp`, data, { withCredentials: true })
        return resp.data
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const signin = async (data) => {
    try {
        const resp = await axios.post(`${URL}/login`, data, { withCredentials: true })
        return resp.data
    } catch (error) {
        alert("Try after some time!")
        console.log("Error : ", error.message)
    }
}

export const logout = async () => {
    try {
        let res = await axios.get(`${URL}/logout`, { withCredentials: true })
    }
    catch (error) {
        console.log("Error Occured!", error.message)
    }
}

export const editProfile = async (form) => {
    try {
        const res = await axios.patch(`${URL}/edit`, form, { withCredentials: true })
        return res.data;
    }
    catch (error) {
        console.log("Error Occured!", error.message)
        return res.data;
    }
}

export const loadProfile = async (data) => {
    try {
        const result = await axios.post(`${URL}/userProfile`, data, { withCredentials: true })
        return result.data
    }
    catch (error) {
        console.log("Error Occured!", error.message)
    }
}

export const searchUser = async (data) => {
    try {
        const resp = await axios.post(`${URL}/search`, data, { withCredentials: true })
        return resp.data.result
    }
    catch (error) {
        console.log("Error Occured!", error.message)
    }
}

export const createChatRoom = async (data) => {
    try {
        const resp = await axios.post(`${URL}/create-chat`, data, { withCredentials: true })
        return resp.data;
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const sendMessage = async (msg) => {
    try {
        const resp = await axios.post(`${URL}/send-message`, msg, { withCredentials: true })
        return resp.data;
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const getFriendList = async () => {
    try {
        const resp = await axios.get(`${URL}/friends`, { withCredentials: true })
        return resp.data.result;
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const getAllMessages = async (chatId) => {
    try {
        const resp = await axios.get(`${URL}/messages/${chatId}`, { withCredentials: true })
        return resp.data.messages
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const getMediaURL = async (form) => {
    try {
        const resp = await axios.post(`${URL}/upload-media`, form, { withCredentials: true })
        return resp.data
    } catch (error) {
        console.log("Error : ", error.message)
        return null;
    }
}

export const clearAllMessages = async (chatId) => {
    try {
        const resp = await axios.delete(`${URL}/clear-chat/${chatId}`, { withCredentials: true })
        return resp.data
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const deleteMessage = async (msgId) => {
    try {
        const resp = await axios.delete(`${URL}/delete-message/${msgId}`, { withCredentials: true })
        return resp.data
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const deleteMessageForEveryone = async (data) => {
    try {
        const resp = await axios.post(`${URL}/delete-message-for-everyone`, data, { withCredentials: true })
        return resp.data
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const deleteChat = async (chatId) => {
    try {
        const resp = await axios.delete(`${URL}/delete-chat/${chatId}`, { withCredentials: true })
        return resp.data
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const loadProfileById = async (id) => {
    try {
        const resp = await axios.get(`${URL}/user-profile-by-id/${id}`, { withCredentials: true })
        return resp.data.result
    } catch (error) {
        console.log("Error : ", error.message)
    }
}

export const findChatId = async (data) => {
    try {
        const resp = await axios.post(`${URL}/getChatId`, data, { withCredentials: true })
        return resp.data.chatId
    } catch (error) {
        console.log("Error : ", error.message)
    }
}
