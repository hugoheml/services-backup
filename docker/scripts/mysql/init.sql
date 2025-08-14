CREATE DATABASE IF NOT EXISTS `database01`;

CREATE TABLE IF NOT EXISTS `table01` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`)
);

INSERT INTO `table01` (`name`, `email`) VALUES
('John Doe', 'john.doe@example.com'),
('Jane Smith', 'jane.smith@example.com');

CREATE TABLE IF NOT EXISTS `table02` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `description` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `table02` (`description`) VALUES
('Sample description 1'),
('Sample description 2');

CREATE DATABASE IF NOT EXISTS `database02`;

CREATE TABLE IF NOT EXISTS `table03` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  PRIMARY KEY (`id`)
);

INSERT INTO `table03` (`title`, `content`) VALUES
('First Post', 'This is the content of the first post.'),
('Second Post', 'This is the content of the second post.');