CREATE TABLE `incidents` (
  `id` int(11) UNSIGNED NOT NULL,
  `message` text NOT NULL,
  `update_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `type` varchar(20) NOT NULL,
  `is_automatic` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `responses` (
  `id` int(11) UNSIGNED NOT NULL,
  `req_type` tinyint(3) UNSIGNED NOT NULL,
  `res_time` mediumint(8) UNSIGNED NOT NULL,
  `res_result` tinyint(1) NOT NULL,
  `res_timestamp` bigint(20) UNSIGNED NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


ALTER TABLE `incidents`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `responses`
  ADD PRIMARY KEY (`id`);


ALTER TABLE `incidents`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `responses`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;
