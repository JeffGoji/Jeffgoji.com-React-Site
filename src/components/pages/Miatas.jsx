import { NavLink } from 'react-router-dom';

import NA from '../../assets/images/na/night4.jpg';
import NB from '../../assets/images/nb/41923629_10215428433037365_6642417182418403328_o.jpg';
import NC from '../../assets/images/ncEdit.jpg';

const Miatas = () => {
    return (
        <div className="container-fluid">
            <div className="row mb-5">
                <h1 className="text-center">Choose your Miata</h1>
                <div className="row row-cols-1 row-cols-md-3 g-4">
                    <div className="col">
                        <NavLink to={'../na-miata'}>
                            <div className="card h-100 bg-black img-hover">
                                <img src={NA} className="card-img-top img-fluid" alt="NA Miata" />
                                <div className="card-body">
                                    <h5 className="card-title text-center">NA6 Miata</h5>
                                    <p className="card-text">I bought this NA6 in 2003 as my first car and it has been with me ever since. Primarily used as a daily driver it has been heavily modified including bushings, suspension, exhaust, intake, and a few other goodies that make it a fun and reliable daily driver that still gets complimented daily from fellow auto enthusiast.</p>

                                </div>
                                <div className="card-footer">
                                    <small className="text-muted">Miyoshi</small>
                                </div>
                            </div></NavLink>
                    </div>

                    <div className="col">
                        <div className="card h-100 bg-black img-hover">
                            <img src={NB} className="card-img-top img-fluid" alt="NB Mazdaspeed" />
                            <div className="card-body">
                                <h5 className="card-title text-center">NB Mazdaspeed</h5>
                                <p className="card-text">This 2004 Mazdaspeed Miata was my second car. It served as a daily driver until 2012 when I began modifying it for Solo Autocross racing. With a nice bump and power, wide wheels and tires and stiff racing suspension, it has won two SCCA championships locally with me driving and is always competing for fastest time of day at BMW and PCA events.</p>

                            </div>
                            <div className="card-footer">
                                <small className="text-muted">Kiryu</small>
                            </div>
                        </div>
                    </div>

                    <div className="col">
                        <div className="card h-100 bg-black img-hover">

                            <img src={NC} className="card-img-top img-fluid" alt="NC MX5 Club" />
                            <div className="card-body">
                                <h5 className="card-title text-center">NC Club</h5>
                                <p className="card-text">One of my more compulsive buys, this was my third Miata and one of my absolute favorite cars of all time. The only modifications it ever needed was a new catback exhaust and a set of Progress swaybars. The power retractable hardtop, larger 2.0 engine, and refined interior made it the best Miata for traveling I have ever driven.
                                    <br />
                                    I toured the United States coast to coast in it back in 2015.</p>

                            </div>
                            <div className="card-footer">
                                <small className="text-muted">Ryoko</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}

export default Miatas;