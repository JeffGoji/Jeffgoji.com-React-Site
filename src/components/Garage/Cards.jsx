import carsData from './Cars.json';

// Import images
import NA from '../../assets/images/na/night4.jpg';
import NB from '../../assets/images/nb/41923629_10215428433037365_6642417182418403328_o.jpg';
import NC from '../../assets/images/ncEdit.jpg';
import ND from '../../assets/images/nd/nd-002.jpg';
import C8 from '../../assets/images/c8/c8-002.jpg';
import Fireball from '../../assets/images/fireball/fireball-2.jpg';

// Create a map of card IDs to images
const cardImages = {
    1: NA,
    2: NB,
    3: NC,
    4: ND,
    5: C8,
    6: Fireball,
};

//eslint-disable-next-line
function Cards({ id, model, description, name }) {
    return (
        <div className="col-lg-3 col-md-4 col-sm-6 mt-2">
            <div className="card h-100 img-hover">
                <img src={cardImages[id]} className="card-img-top img-fluid" alt={carsData.model} />
                <div className="card-body">
                    <h5 className="card-title text-center">{model}</h5>
                    <p className="card-text">{description}</p>
                </div>
                <div className="card-footer">
                    <small className="text-muted">{name}</small>
                </div>
            </div>
        </div>
    );
}

export default Cards;

