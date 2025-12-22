# Digital Books Store
> A modern, scalable platform for selling digital Books built with NestJS, TypeScript

## Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- OAuth 2.0 integration (Google, GitHub)
- Role-based access control (Admin, Customer)
- Email verification and password reset

### E-Commerce Core
- Product catalog with categories
- Shopping cart with price locking
- Discount code system with validation
- Order management and tracking

### Payment Processing
- Paymob payment gateway integration
- Secure webhook handling with HMAC verification
- Automatic payment receipt emails
- Transaction tracking and reconciliation

### Asynchronous Processing
- RabbitMQ message queue for background jobs
- Email queue with retry logic
- Scalable worker architecture

### Database & Caching
- MySQL with Prisma ORM
- Redis caching
- Optimized queries with proper indexing
- Soft deletes for data integrity

### DevOps & Infrastructure
- Docker containerization
- Docker Compose for local development
- CI/CD with GitHub Actions
- Health checks and monitoring endpoints
- Automated testing pipeline

### Code Quality
- TypeScript strict mode
- ESLint + Prettier
- Unit tests (Jest)
- E2E tests (Supertest)
- Comprehensive logging (Winston)

### Installation

1. Clone the repository
```bash
https://github.com/Ahmedali64/Digital-E-Commerce-V1.git
cd Digital-E-Commerce-V
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start with Docker Compose
```bash
docker-compose up -d
```

5. Run migrations
```bash
npm prisma:migrate
```

6. Access the API
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api/docs
- RabbitMQ UI: http://localhost:15672
- 

## 📖 API Documentation

Full API documentation is available via Swagger at `/api/docs` when running the application 

or Full API documentation (with example requests and responses) is available here:  
[View in Postman](https://documenter.getpostman.com/view/21578024/2sB3dWrSUS)

## Tech Stack
- **Runtime**: Node.js 20
- **Framework**: NestJS 10
- **Language**: TypeScript 5
- **Database**: MySQL 8.0
- **ORM**: Prisma 7
- **Cache**: Redis 7
- **Queue**: RabbitMQ 3
- **Email**: NodeMailer
- **Payment**: Paymob
- **Testing**: Jest, Supertest
- **Documentation**: Swagger/OpenAPI

### Project Structure
```
src/
├── modules/
│   ├── auth/          # Authentication & authorization
│   ├── users/         # User management
│   ├── products/      # Product catalog
│   ├── categories/    # Product categories
│   ├── cart/          # Shopping cart
│   ├── orders/        # Order management
│   ├── payment/       # Paymob integration
│   ├── queue/         # RabbitMQ producers & consumers
│   ├── mail/          # Email service
│   └── webhooks/      # Payment webhooks
├── common/            # Shared utilities & decorators
├── config/            # Configuration files
└── prisma/            # Database schema & migrations
```

### Design Patterns
- **Repository Pattern** (Prisma)
- **Dependency Injection** (NestJS IoC)
- **Queue Pattern** (RabbitMQ)
- **Webhook Pattern** (Payment callbacks)
- **Strategy Pattern** (OAuth providers)

## Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```
## Security Features

- Helmet.js for HTTP headers
- CORS configuration
- Rate limiting (Express Rate Limit + Throttler)
- JWT with refresh token rotation
- Password hashing (bcrypt)
- HMAC signature verification for webhooks
- Input validation (class-validator)
- SQL injection protection (Prisma)

## Monitoring & Observability

- Health check endpoints (`/health`)
- Structured logging with Winston
- Request/response logging
- Error tracking and stack traces
- Performance metrics ready
- Standalone app for CORN jobs to save server performance

## Deployment

### Docker Production Build
```bash
docker-compose -f docker-compose.yml up -d
```

### Environment Variables
See `.env.example` for all required environment variables.

Key variables:
- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `PAYMOB_API_KEY` - Paymob API credentials
- `RABBITMQ_URL` - RabbitMQ connection string

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Author

**Your Name**
- GitHub: [@ahmedali64](https://github.com/Ahmedali64)
- LinkedIn: [Ahmed Ali](www.linkedin.com/in/ahmed-ali-esmail)
