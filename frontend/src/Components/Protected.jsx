import { Navigate } from "react-router-dom"

function Protected({ children }) {

    if (!localStorage.getItem('login')) {
        return <Navigate to="/login" replace />
    }
    return children


}

export default Protected