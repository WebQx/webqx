FROM php:8.3-apache

# Set working directory
WORKDIR /var/www/html

# Install system dependencies and PHP extensions required by OpenEMR
RUN apt-get update && apt-get install -y \
    git curl unzip zip \
    default-mysql-client \
    libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    libonig-dev libxml2-dev libldap2-dev libcurl4-openssl-dev \
    imagemagick libmagickwand-dev \
  && docker-php-ext-configure gd --with-freetype --with-jpeg \
  && docker-php-ext-install -j"$(nproc)" \
       pdo_mysql gd intl zip soap xml mbstring exif bcmath opcache \
  && pecl install redis imagick \
  && docker-php-ext-enable redis imagick \
  && a2enmod rewrite headers expires ssl deflate \
  && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy Apache and PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/php.ini
COPY docker/php/webqx.conf /usr/local/etc/php/conf.d/webqx.conf
COPY docker/apache/webqx-site.conf /etc/apache2/sites-available/000-default.conf
COPY docker/apache/apache2.conf /etc/apache2/apache2.conf

# Copy application code from this subproject into the web root
COPY . /var/www/html/

# Ensure permissions for Apache (www-data)
RUN mkdir -p /var/www/html/uploads /var/www/html/logs /var/log/webqx \
  && chown -R www-data:www-data /var/www/html \
  && chmod -R 755 /var/www/html \
  && chmod -R 777 /var/www/html/uploads /var/www/html/logs

# Provide entrypoint to configure Apache port and database settings from env
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment configuration
ENV APACHE_DOCUMENT_ROOT=/var/www/html \
    APACHE_LOG_DIR=/var/log/apache2 \
    WEBQX_VERSION=1.0.0 \
    PHP_MEMORY_LIMIT=512M \
    PHP_MAX_EXECUTION_TIME=300 \
    PHP_UPLOAD_MAX_FILESIZE=100M \
    PHP_POST_MAX_SIZE=100M

# Health check (basic index probe)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://127.0.0.1/ || exit 1

# Expose default ports (Apache listens on 80; entrypoint may reconfigure)
EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
CMD ["apache2-foreground"]
