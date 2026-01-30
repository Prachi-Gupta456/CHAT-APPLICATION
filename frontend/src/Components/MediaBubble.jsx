import '../Styles/chatWindowStyle.css'

export default function MediaBubble({ file }) {
    
    let content;
    const fileURL = URL.createObjectURL(file)

    if (file.type.startsWith("image/")) {
        content = <img className="chat-bubble" alt="preview-image" src={fileURL} />
    }

    else if (file.type.startsWith("video/")) {
        content = <video className="chat-bubble" alt="preview-video" src={fileURL} controls />
    }

    else if (file.name.endsWith(".pdf")) {
        content = ( <a className="chat-bubble" href={fileURL} target="_blank" rel="noreferrer"> 📄 {file.name} (PDF)</a> )
    }

    else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        content =  ( <a className="chat-bubble" href={fileURL} target="_blank" rel="noreferrer"> 📄 {file.name} (DOCX)</a> )
    }

    else{
        content = <span className="chat-bubble">Unsupported file</span>
    }

    return(
        <>
          {content}
        </>
    )
} 