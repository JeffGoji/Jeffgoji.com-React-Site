import { useState, useEffect } from "react" 

function Footer() {

    const [currentYear, setCurrentYear] = useState()

    const getCurrentYear = () => {
        const date = new Date()
        const year = date.getFullYear()
        setCurrentYear(year)
    }

    useEffect(() => {
        getCurrentYear()
    }, [])

    return (
        <footer className='container-fluid text-center pt-0 p-0 m-0 fixed-bottom'>
            <div className="row p-0 m-0">
                <div className="col-12 p-1 m-0"><h6>JeffGoji.com &copy; {currentYear}</h6></div>
            </div>
        </footer>
    )
}

export default Footer