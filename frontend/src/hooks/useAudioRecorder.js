import { useState,useRef } from "react"

export default function useAudioRecorder() {
    const mediaRecorderRef = useRef(null)
    const [recording, setRecording] = useState(false)
    const audioChunks = useRef([])

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorderRef.current = new MediaRecorder(stream)

        audioChunks.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
            audioChunks.current.push(e.data)
        }

        mediaRecorderRef.current.start();
        setRecording(true)
    }


    const stopRecording = async () => {
        return new Promise((resolve) => {
            mediaRecorderRef.current.onstop = () => {

                const audioBlob = new Blob(audioChunks.current, {
                    type: "audio/webm"
                })

                resolve(audioBlob)
            }

            mediaRecorderRef.current.stop()
            setRecording(false)
        })
    }

    return { startRecording, stopRecording, recording };

}