import { useEffect } from "react";

export default function useClickOutSide(ref, closeFn) {
    useEffect(() => {

        function handleClick(event) {


            if (ref.current && ref.current.contains(event.target)) {
                return;
            }

            // click is outside close sidebar
            closeFn()
        }

        document.addEventListener("pointerdown", handleClick)

        return () => document.removeEventListener("pointerdown", handleClick)

    }, [ref, closeFn])
}
