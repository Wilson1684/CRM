<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Management Solution</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.1/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
    
</head>
<body>
    
    <!-- Navbar -->
    <?php include 'navbar.php'; ?>

    <!-- Hero Section -->
    <section class="hero" id="home">
        <div class="container">
            <h1>Revolutionizing Service Management</h1>
            <p>Streamline operations and enhance customer satisfaction with our cutting-edge solution.</p>
            <a href="#features" class="btn btn-primary btn-lg">Learn More</a>
        </div>
    </section>

    <!-- Features Section -->
    <section class="container mt-5" id="features">
        <h2 class="text-center">Our Features</h2>
        <div class="row">
            <div class="col-md-4 feature-card">
                <div class="card">
                    <div class="card-body text-center">
                        <h5 class="card-title">Customer App</h5>
                        <p class="card-text">Easily browse services, initiate requests, and communicate via text, WhatsApp, or photo submissions.</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 feature-card">
                <div class="card">
                    <div class="card-body text-center">
                        <h5 class="card-title">Technician App</h5>
                        <p class="card-text">Real-time task tracking, updates, and direct communication for seamless on-site operations.</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 feature-card">
                <div class="card">
                    <div class="card-body text-center">
                        <h5 class="card-title">Admin CMS</h5>
                        <p class="card-text">Efficiently manage service requests, inventory, and workflows with advanced analytics.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- About Section -->
    <section class="container mt-5" id="about">
        <h2 class="text-center">About Us</h2>
        <p>We are dedicated to transforming service management by addressing common challenges like communication delays, inconsistent experiences, and inefficient workflows. Our mission is to deliver innovative solutions that enhance operational efficiency and customer satisfaction.</p>
    </section>

    <!-- Contact Section -->
    <section class="container mt-5" id="contact">
        <h2 class="text-center">Contact Us</h2>
        <form>
            <div class="form-group">
                <label for="name">Name:</label>
                <input type="text" class="form-control" id="name" placeholder="Your Name">
            </div>
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" class="form-control" id="email" placeholder="Your Email">
            </div>
            <div class="form-group">
                <label for="message">Message:</label>
                <textarea class="form-control" id="message" rows="4" placeholder="Your Message"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Submit</button>
        </form>
    </section>

    <!-- Footer -->
    <?php include 'footer.php'; ?>
</body>
</html>