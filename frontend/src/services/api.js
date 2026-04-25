import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message)
    
    // Handle specific error cases
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 3000.')
    }
    
    if (error.response?.status === 500) {
      throw new Error(error.response.data?.message || 'Server error occurred')
    }
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.message || 'Invalid request')
    }
    
    throw new Error(error.response?.data?.message || error.message || 'Network error')
  }
)

// API functions
export const generateVideo = async (prompt) => {
  try {
    const response = await api.post('/api/video/generate', { prompt })
    return response.data
  } catch (error) {
    console.error('Generate video error:', error)
    throw error
  }
}

export const getProjectStatus = async (projectId) => {
  try {
    const response = await api.get(`/api/video/status/${projectId}`)
    return response.data
  } catch (error) {
    console.error('Get project status error:', error)
    throw error
  }
}

export const downloadVideo = async (projectId) => {
  try {
    const response = await api.get(`/api/video/download/${projectId}`, {
      responseType: 'blob'
    })
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `invideo-${projectId}.mp4`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    
    return true
  } catch (error) {
    console.error('Download video error:', error)
    throw error
  }
}

export const getVideoUrl = (projectId) => {
  return `${API_BASE_URL}/api/video/download/${projectId}`
}

export const deleteProject = async (projectId) => {
  try {
    const response = await api.delete(`/api/video/project/${projectId}`)
    return response.data
  } catch (error) {
    console.error('Delete project error:', error)
    throw error
  }
}

export const getHealthStatus = async () => {
  try {
    const response = await api.get('/api/video/health')
    return response.data
  } catch (error) {
    console.error('Health check error:', error)
    throw error
  }
}

export const getAllProjects = async () => {
  try {
    const response = await api.get('/api/video/projects')
    return response.data
  } catch (error) {
    console.error('Get all projects error:', error)
    throw error
  }
}

// Utility function to format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Utility function to format duration
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Utility function to check if backend is reachable
export const checkBackendHealth = async () => {
  try {
    await api.get('/health', { timeout: 5000 })
    return true
  } catch (error) {
    console.warn('Backend health check failed:', error.message)
    return false
  }
}

export default api