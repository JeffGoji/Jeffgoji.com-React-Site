import { useEffect, useState } from 'react';
import { firestore } from '../../../firebase-config';
import { collection, getDocs } from 'firebase/firestore';

const FireballPosts = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(firestore, 'fireball'));
                const postsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setPosts(postsData);
            } catch (error) {
                console.error('Error fetching posts from Firestore', error);
            }
            setLoading(false);
        };

        fetchPosts();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className='text-center row justify-content-center'>
            <div className='col-lg-10 col-md-12 col-sm-12 text-center'>
                {posts.map(post => (
                    <div key={post.id} className="card mt-5 justify-content-center text-center shadow-sm">
                        <div className='card-header'>
                            <h4 className="card-title">{post.title}</h4>
                        </div>
                        <div className="card-body">
                            {post.imageUrl && <img src={post.imageUrl} alt={post.title} className="img-fluid rounded" />}
                        </div>

                        <ul className="list-group list-group-flush text-start">
                            <li className="list-group-item">Date: {post.date}</li>
                            <li className="list-group-item">Current Mileage: {post.mileage}</li>
                        </ul>
                        <div className="card-body">
                            <p className="card-text">{post.story}</p>
                        </div>

                        {/* <div className="card-body">
                        <a href="#" className="card-link">Card link</a>
                        <a href="#" className="card-link">Another link</a>
                    </div> */}
                    </div>

                ))}
            </div>

            {/* {
                posts.map(post => (
                    <div key={post.id} className='text-center row justify-content-center'>

                        <h3>{post.title}</h3>
                        {post.imageUrl && <img src={post.imageUrl} alt={post.title} className="img-fluid rounded w-50" />}

                        <p>{post.date}</p>

                        <p>{post.story}</p>
                    </div>
                ))
            } */}
        </div>
    );
};

export default FireballPosts;
