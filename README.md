# RC Planet E-commerce

A modern e-commerce platform for RC products built with Next.js, MongoDB, and Stripe.

## Features

- User authentication and authorization
- Product catalog with search and filtering
- Shopping cart functionality
- Secure payment processing with Stripe
- Image upload with Cloudinary
- Email notifications with SendGrid
- Responsive design
- Admin dashboard

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, MongoDB
- Authentication: JWT, NextAuth.js
- Payment: Stripe
- Image Hosting: Cloudinary
- Email: SendGrid
- Deployment: GitHub Pages

## Getting Started

### Prerequisites

- Node.js 18.x or later
- MongoDB Atlas account
- Stripe account
- Cloudinary account
- SendGrid account
- GitHub account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rcplanet.git
   cd rcplanet
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required environment variables in `.env.local`

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploying to GitHub Pages

1. First, create a new repository on GitHub if you haven't already.

2. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/rcplanet.git
   git push -u origin main
   ```

3. Install the required dependencies for GitHub Pages:
   ```bash
   npm install gh-pages --save-dev
   ```

4. Update your `package.json` to include the following scripts:
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d out",
       "build": "next build && next export"
     }
   }
   ```

5. Create a `.github/workflows/deploy.yml` file with the following content:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - name: Checkout
           uses: actions/checkout@v2
         - name: Setup Node.js
           uses: actions/setup-node@v2
           with:
             node-version: '18'
         - name: Install dependencies
           run: npm ci
         - name: Build
           run: npm run build
           env:
             NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
             NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
             NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: ${{ secrets.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME }}
             NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
             NEXTAUTH_URL: ${{ secrets.NEXTAUTH_URL }}
         - name: Deploy
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./out
   ```

6. Go to your GitHub repository settings:
   - Navigate to "Settings" > "Pages"
   - Under "Source", select "GitHub Actions"
   - Your site will be available at `https://yourusername.github.io/rcplanet`

7. Set up your environment variables in GitHub:
   - Go to your repository settings
   - Navigate to "Secrets and variables" > "Actions"
   - Add all your environment variables as repository secrets

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://api.rcplanet.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://yourusername.github.io/rcplanet
```

### Backend (.env)
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
NODE_ENV=production
STRIPE_SECRET_KEY=your_stripe_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
EMAIL_SERVER_HOST=smtp.sendgrid.net
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=apikey
EMAIL_SERVER_PASSWORD=your_sendgrid_api_key
EMAIL_FROM=noreply@rcplanet.com
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 