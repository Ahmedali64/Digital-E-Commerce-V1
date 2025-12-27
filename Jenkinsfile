/* groovylint-disable-next-line CompileStatic */
pipeline {
    agent none

    stages {
        stage('Checkout') {
            agent any
            steps {
                git branch: 'testing-new-features',
                url: 'https://github.com/Ahmedali64/Digital-E-Commerce-V1.git'
            }
        }
        stage('Test') {
            agent {
                docker {
                    image 'node:22-alpine'
                    reuseNode true
                }
            }
            steps {
                // From what i understood now we have all these files inside a docker container
                // so we can just install all the libs and run the Test
                sh 'npm ci'
                sh 'npm run test'
            }
        }
        stage('Build-Running-Docker-Compose') {
            agent any
            steps {
                withCredentials([file(credentialsId: 'app-env-file', variable: 'ENV_FILE')]) {
                    sh 'cp $ENV_FILE .env'
                    sh 'docker-compose --env-file .env up --build -d'
                }
                sh 'docker-compose up --build -d'
            }
        }
        stage('Health-Check') {
            agent any
            steps {
                echo 'From here we will start our heath checking'
                sh 'curl http://localhost:8080/health'
            }
        }
        stage('Test Endpoints') {
            agent any
            steps {
                sh '''
                    echo "Testing /products"
                    curl -f http://localhost:80/products
                '''
                echo 'Tests passed'
            }
        }
    }
    post {
        always {
            sh 'docker-compose down || true'
            echo "Build #${BUILD_NUMBER} finished"
        }
        success {
            echo 'BUILD SUCCESSFUL!'
        }
        failure {
            echo 'BUILD FAILED!'
            sh 'docker-compose logs --tail=50 || true'
        }
    }
}
