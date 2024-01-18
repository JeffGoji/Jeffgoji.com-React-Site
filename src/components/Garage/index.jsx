

//Images
// import NA from '../../assets/images/na/night4.jpg';
// import NB from '../../assets/images/nb/41923629_10215428433037365_6642417182418403328_o.jpg';
// import NC from '../../assets/images/ncEdit.jpg';
// import ND from '../../assets/images/nd/nd-002.jpg';
// import C8 from '../../assets/images/c8/c8-002.jpg';

// Import JSON data
import carsData from './Cars.json';
import Cards from './Cards';

// Create a map of card IDs to images
// const cardImages = {
//     1: NA,
//     2: NB,
//     3: NC,
//     4: ND,
//     5: C8,
// };

const Garage = () => {
    return (
        <div className="container-fluid mt-4">
            <div className="row">
                <div className="col-lg-5 col-md-4 col-sm-4">
                    <hr />
                    <hr />
                </div>
                <div className="col-lg-2 col-md-4 col-sm-4">
                    <h1 className="text-center mb-3 text-outline fw-bold">The Garage</h1>
                </div>
                <div className="col-lg-5 col-md-4 col-sm-4">
                    <hr />
                    <hr />
                </div>
            </div>
            <div className="row">
                {carsData.cars.map((car) => (
                    <Cards
                        key={car.id}
                        id={car.id}
                        model={car.model}
                        description={car.description}
                        name={car.name}
                    />
                ))}
            </div>
        </div>
    );
};

export default Garage;

