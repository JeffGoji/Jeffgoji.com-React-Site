import React from 'react';

//Image Import
import IntroImg from '../../assets/images/autox001.jpg'

function Intro() {

    return (

        <div className="row justify-content-center intro text-white">
            <div className="col-lg-8 col-md-12 col-sm-12">
                <h1 className="text-shadow text-center">Welcome to my Site!</h1>
                <img src={IntroImg} style={{ width: '500px' }} className="rounded-3 imgshadow mb-3 mx-auto d-block img-shadow img-fluid" alt="me and my car"></img>


                <p className="m-2">I am an avid automotive and driving enthusiast and I got my start by buying a 1991 NA6 MX5 back in 2003. I then
                    took up Autocross and became pretty darn good at it locally, and quickly learned my way around tuning a
                    suspension setup and going faster.
                    This website is a database of various adventures I have had in my life when it comes to my passion for all
                    things automotive. It also serves as an online record of significant events and upgrades made by me to various
                    vehicles I have owned and currently own.
                    <br />
                    So feel free to peruse the photo galleries, check out product reviews, and have a look at my car’s
                    specifications and blogs.
                    <br />
                    I’m always adding more content so check back often!
                </p>
            </div>
        </div>
    );
}

export default Intro;