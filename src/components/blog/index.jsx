// Blog.js
import { useEffect, useState } from 'react';
import { firestore } from '../../firebase-config.js';

const Blog = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const snapshot = await firestore.collection('posts').get();
                const postsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setPosts(postsData);
            } catch (error) {
                console.error("Error fetching posts:", error);
            }
            setLoading(false);
        };

        fetchPosts();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            {posts.length > 0 ? (
                posts.map(post => (
                    <div key={post.id}>
                        <h3>{post.title}</h3>
                        <p>{post.content}</p>
                    </div>
                ))
            ) : (
                <p>No posts found</p>
            )}
        </div>
    );
};

export default Blog;
