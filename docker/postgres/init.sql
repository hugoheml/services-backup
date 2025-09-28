CREATE DATABASE database01 OWNER myuser;
CREATE DATABASE database02 OWNER myuser;

\connect database01

CREATE TABLE IF NOT EXISTS table01 (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL
);

INSERT INTO table01 (name, email) VALUES
    ('John Doe', 'john.doe@example.com'),
    ('Jane Smith', 'jane.smith@example.com');

CREATE TABLE IF NOT EXISTS table02 (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO table02 (description) VALUES
    ('Sample description 1'),
    ('Sample description 2');

\connect database02

CREATE TABLE IF NOT EXISTS table03 (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL
);

INSERT INTO table03 (title, content) VALUES
    ('First Post', 'This is the content of the first post.'),
    ('Second Post', 'This is the content of the second post.');
