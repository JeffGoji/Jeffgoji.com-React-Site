import data from '../../assets/Data/MsmBlog.json';

function MsmBlog() {

    const msmBlogList = data.map((data) =>
        <div className='row justify-content-center mb-2' key={data.id}>
            <div className="col-lg-6 col-md-10 col-sm-12 mt-3">
                <div className='card bg-dark rounded p-2 img-shadow-red  text-white'>
                    <div className='text-center'>
                        <img src={data.picture} className="img-fluid rounded" alt="this post's pic" />
                    </div>
                    <ul className='mt-3 rounded'>
                        <li className='p-1 rounded'>Date: {data.date}</li>
                        <li className='p-1 rounded'>Mileage: {data.mileage}  miles</li>
                        <li className='p-1 rounded'>Cost for this entry: {data.cost} </li>
                    </ul>
                    <hr />
                    <p style={{ whiteSpace: "pre-line" }}>{data.entry}</p>
                    <p className='text-center'><a href="#top">Back to top</a></p>
                    <hr className="bloghr">
                    </hr>
                </div>
            </div>
        </div>

    )

    return (
        <div className='row justify-content-center text-white mt-1'>
            <div className='col-lg-9 col-md-12 col-sm-12'>
                <h2 className='text-center text-shadow text-black'>Mazdaspeed Miata Blog</h2>
                {msmBlogList}
            </div>

        </div>
    )
}



export default MsmBlog;