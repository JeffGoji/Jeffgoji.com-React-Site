import data from '../../assets/Data/MsmBlog.json';

function MsmBlog() {

    const msmBlogList = data.map((data) =>
        <div class="col-lg-10 col-md-10 col-sm-12 mt-5" key={data.id}>
            <div className='card bg-dark rounded p-2 img-shadow-red '>
                <center>
                    <img src={data.picture} class="img-fluid rounded" alt="this post's pic" />
                </center>
                <ul className='mt-3 rounded'>
                    <li className='p-1 rounded'>Date: {data.date}</li>
                    <li className='p-1 rounded'>Mileage: {data.mileage}  miles</li>
                    <li className='p-1 rounded'>Cost for this entry: {data.cost} </li>
                </ul>
                <hr />
                <p style={{ whiteSpace: "pre-line" }}>{data.entry}</p>
                <p>
                    <center><a href="#top">Back to top</a></center>
                </p>

                <hr class="bloghr">
                </hr>
            </div>
        </div>
    )

    return (
        <div className='row justify-content-center'>
            <h2 className='text-center mt-5'>Mazdaspeed Miata Blog</h2>
            {msmBlogList}
        </div>
    )
}



export default MsmBlog;