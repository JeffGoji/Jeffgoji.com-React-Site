
const Blog = () => {

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
