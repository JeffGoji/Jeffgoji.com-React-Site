import Pic2 from '../../assets/images/na/12370920_10207027821827335_8393944522748518224_o.jpg'

const NaMiata = () => {
    return (
        <div className='container-fluid na-background'>
            <div className='row mb-5'>
                <h1 className='text-center mb-5'>1991 NA 1.6 Miata - "Miyoshi"</h1>
                <div className="col-lg-6 col-sm-12 mt-5">
                    <p>I bought this 1991 Miata on February 23rd 2003, and I'm the third owner. The car is pretty amazing
                    </p>
                </div>

                <div className="col-lg-6 col-sm-12 mt-5">
                    <img src={Pic2} alt="91 Miata" className="img-rounded img-fluid" style={{ maxHeight: "30srem" }} />
                </div>
                <div className='col-lg-6 col-sm-6 col-sm-12 text-center'>
                    <h3 className="text-center">Modifications</h3>
                    <ul>
                        <h4 className="text-center mt-5">Suspension</h4>
                        <li className="rounded-2 p-1">Xida XL coilovers (300/200 lb/in spring rates)</li>
                        <li className="rounded-2 p-1">RacingBeat 15/16" front swaybar</li>
                        <li className="rounded-2 p-1">ILM suspension bushing kit</li>
                        <h4 className="text-center mt-5">Engine</h4>
                        <li className="rounded-2 p-1">RacingBeat Header</li>
                        <li className="rounded-2 p-1">Flyin'Miata high-flow cat</li>
                        <li className="rounded-2 p-1">Borla cat-back exhaust</li>
                        <h4 className="text-center mt-5">Drivetrain</h4>
                        <li className="rounded-2 p-1">Mazdaspeed Miata 6-speed Transmission</li>
                        <li className="rounded-2 p-1">4.10 Torsen differential</li>
                    </ul>
                </div>
            </div>
        </div>

    )
}

export default NaMiata