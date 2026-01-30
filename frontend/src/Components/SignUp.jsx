import React, { useState } from "react"
import { useActionState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import "../Styles/form.css"
import { signup } from "../API"

function SignUp() {

    const [filled, setFilled] = useState(true)
    const navigate = useNavigate()

    const handleSignUp = async (previousData, formData) => {

        let name = formData.get('name')
        let email = formData.get('email')
        let password = formData.get('password')

        if (!name || !email || !password) {
            setFilled(false)
            return;
        }

        // check email validation-------------------
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return alert("Invalid email address!")
        }
        // ------------------------------------------


        try {
            const data = {
                name: name,
                email: email,
                password: password
            }

            const result = await signup(data)

            if (result.exist) {
                return alert("User already exist!")
            }


           const user = result.user
            alert("SignUp done!")
            localStorage.setItem('login', email)
            navigate("/chats")
        }
        catch (error) {
            console.log("Error occured : ", error.message)
            alert("Try after some time!")
        }
    }

    const [data, action, pending] = useActionState(handleSignUp, undefined)


    return (
        <div className="box-container">
            <div className="form-container">
                <h1>Sign Up</h1>
                {filled ? null : <div style={{ "color": "red" }}>Field values can't be empty! </div>}

                <form action={action}>

                    <div className="box">
                        <label htmlFor="">Name</label>
                        <input type="text" placeholder="Enter user name" name="name"></input>
                    </div>

                    <div className="box">
                        <label htmlFor="">Email</label>
                        <input type="text" placeholder="Enter user email" name="email"></input>
                    </div>

                    <div className="box">
                        <label htmlFor="">Password</label>
                        <input type="password" placeholder="Enter user password" name="password"></input>
                    </div>

                    <div className="btn">
                        <button className="submit" disabled={pending} >{pending ? "Signing Up..." : "Sign up"} </button>
                    </div>

                </form>

                <NavLink to="/login" className="links">Login</NavLink>
            </div>
        </div>


    )
}

export default SignUp
