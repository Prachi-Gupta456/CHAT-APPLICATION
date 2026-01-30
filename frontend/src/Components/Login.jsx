import { useEffect, useState } from "react"
import { useActionState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { signin } from "../API"
import "../Styles/form.css"


function Login() {

    const [filled, setFilled] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        setFilled(true)
    })


    const handleLogin = async (previousData, formData) => {


        let email = formData.get('email')
        let password = formData.get('password')

        const data = {
            email: email,
            password: password
        }

        if (!email || !password) {
            setFilled(false)
            return;
        }

        // check email validation-------------------
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

        if (!emailRegex.test(email)) {
            return alert("Invalid email address!")
        }
        // ------------------------------------------
        const result = await signin(data)

        if (result.exist && !result.success) {
            return alert("Invalid Password!")
        }
        else if (!result.exist) {
            return alert("User not found!")
        }

        localStorage.setItem('login', email)
        navigate("/chats")
    }

    const [data, action, pending] = useActionState(handleLogin, undefined)



    return (
        <div className="box-container">
            <div className="form-container">
                <h1>Login</h1>
                {filled ? null : <div style={{ "color": "red" }}>Field values can't be empty! </div>}

                <form action={action}>

                    <div className="box">
                        <label htmlFor="">Email</label>
                        <input type="text" placeholder="Enter user email" name="email"></input>
                    </div>

                    <div className="box">
                        <label htmlFor="">Password</label>
                        <input type="password" placeholder="Enter user password" name="password"></input>
                    </div>

                    <div className="btn">
                        <button className="submit" disabled={pending} >{pending ? "Signing in..." : "Login"} </button>

                    </div>

                </form>

                <NavLink to="/signup" className="links">Sign Up</NavLink>
            </div>
        </div>
    )
}
export default Login
