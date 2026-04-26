const axios = require('axios');
const OpenAI = require('openai');

class ScriptService {
  constructor() {
    this.llmServer = process.env.LLM_SERVER || 'ollama';
    
    // Ollama Configuration
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'mistral';
    
    // OpenAI Configuration
    this.openaiClient = null;
    if (this.llmServer === 'openai' || process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }
    
    console.log(`🤖 ScriptService initialized with LLM server: ${this.llmServer}`);
  }

  async generateScript(topic) {
    try {
      console.log(`🤖 Generating script for topic: ${topic} using ${this.llmServer}`);
      
      const prompt = `Write a comprehensive, detailed, and engaging video script about: ${topic}.
      
      REQUIREMENTS:
      - Target 1200-1500 words for a 10-minute video
      - Make it highly informative and engaging throughout
      - Include detailed explanations, examples, jokes, and storytelling
      - Structure with clear sections that flow naturally
      - Add interesting facts, statistics, or anecdotes
      - Make it conversational but substantive
      - Focus on providing real value to viewers
      - Include multiple aspects and perspectives on the topic
      - Use descriptive language that works well for visuals
      
      Create a script that could easily fill 8-12 minutes of engaging narration.`;

      let script;

      if (this.llmServer === 'openai') {
        script = await this.generateScriptWithOpenAI(prompt);
      } else if (this.llmServer === 'ollama') {
        script = await this.generateScriptWithOllama(prompt);
      } else {
        throw new Error(`Unsupported LLM server: ${this.llmServer}`);
      }

      if (script) {
        console.log('✅ Script generated successfully');
        return script;
      } else {
        throw new Error('Failed to generate script from LLM service');
      }
    } catch (error) {
      console.error('Error generating script:', error.message);
      
      // Fallback script if LLM services are not available
      console.log('📝 Using fallback script generation');
      return this.generateFallbackScript(topic);
    }
  }

  async generateScriptWithOpenAI(prompt) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured. Check OPENAI_API_KEY.');
    }

    try {
      console.log(`🔗 Sending request to OpenAI API (${this.openaiModel})`);
      
      const completion = await this.openaiClient.chat.completions.create({
        model: this.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert video script writer who creates engaging, informative, and well-structured content for educational videos.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim();
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }

  async generateScriptWithOllama(prompt) {
    try {
      console.log(`🔗 Sending request to Ollama API (${this.ollamaModel})`);
      
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2000  // Fixed: using num_predict instead of max_tokens
        }
      }, {
        timeout: 60000,  // 60 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.response) {
        return response.data.response.trim();
      } else {
        throw new Error('Invalid response from Ollama API');
      }
    } catch (error) {
      console.error('Ollama API Error:', error.message);
      throw error;
    }
  }

  generateFallbackScript(topic) {
    console.log('📝 Generating comprehensive fallback script for topic:', topic);
    
    // Determine category based on topic keywords
    const topicLower = topic.toLowerCase();
    let category = 'default';
    
    if (topicLower.includes('travel') || topicLower.includes('trip') || topicLower.includes('vacation') || topicLower.includes('greece') || topicLower.includes('paris') || topicLower.includes('japan') || topicLower.includes('city') || topicLower.includes('country')) {
      category = 'travel';
    } else if (topicLower.includes('food') || topicLower.includes('recipe') || topicLower.includes('cooking') || topicLower.includes('restaurant') || topicLower.includes('cuisine') || topicLower.includes('dish')) {
      category = 'food';
    } else if (topicLower.includes('tech') || topicLower.includes('ai') || topicLower.includes('computer') || topicLower.includes('software') || topicLower.includes('digital') || topicLower.includes('algorithm')) {
      category = 'technology';
    }

    // Generate appropriate script based on category
    let script = '';
    
    if (category === 'travel') {
      script = `Welcome to the ultimate comprehensive guide to ${topic}! Today we're embarking on an extraordinary journey that will take you through every aspect of this incredible destination, from its breathtaking natural wonders to its rich cultural heritage, fascinating history, and modern attractions that make it one of the world's most captivating places to visit.

Let's begin with the geographical setting that makes ${topic} so unique and spectacular. The landscape here tells a story millions of years in the making, with dramatic coastlines carved by ancient seas, majestic mountains that reach toward the sky, and valleys that have witnessed the rise and fall of civilizations. The climate creates perfect conditions for diverse ecosystems, supporting everything from pristine forests to crystal-clear lakes and rivers that have sustained communities for thousands of years.

The rich history of ${topic} spans millennia, with archaeological evidence revealing continuous human habitation dating back to prehistoric times. Ancient civilizations left their mark through magnificent architectural achievements that still stand today as testaments to human ingenuity and artistic vision. Medieval periods brought castle fortifications, religious monuments, and trade routes that connected this region to the broader world. The Renaissance period introduced artistic masterpieces and cultural innovations that continue to influence global art and philosophy.

Modern ${topic} represents a fascinating blend of historical preservation and contemporary innovation. Urban centers showcase cutting-edge architecture while maintaining their historical character through careful city planning and restoration projects. Transportation infrastructure connects remote villages to major cities, making it possible for visitors to experience both traditional rural life and cosmopolitan amenities during a single trip.

The cultural diversity found throughout ${topic} reflects centuries of migration, trade, and cultural exchange. Local festivals celebrate seasonal changes, religious traditions, and historical events through colorful processions, traditional music, and authentic cuisine prepared according to recipes passed down through generations. Artisan workshops continue ancient crafts using traditional techniques, creating unique handmade products that serve as perfect souvenirs and support local economies.

Culinary traditions in ${topic} represent a sophisticated fusion of indigenous ingredients, traditional cooking methods, and influences from neighboring regions and international trade connections. Local markets overflow with fresh seasonal produce, aromatic spices, and specialty items that reflect the region's agricultural abundance and culinary creativity. Restaurant scenes range from family-run establishments serving time-honored recipes to innovative chefs creating contemporary interpretations of classic dishes.

Adventure opportunities abound for every type of traveler, whether you seek adrenaline-pumping outdoor activities or peaceful contemplative experiences. Hiking trails wind through diverse terrain, offering spectacular viewpoints and encounters with local wildlife. Water activities take advantage of pristine coastlines, rivers, and lakes, while mountain regions provide excellent opportunities for climbing, skiing, and nature photography.

Accommodation options cater to every preference and budget, from luxury resorts with world-class amenities to charming bed-and-breakfast establishments run by local families who share insider knowledge about hidden gems and authentic experiences. Unique lodging opportunities include historic buildings converted into boutique hotels, eco-friendly accommodations that minimize environmental impact, and camping facilities for those who prefer closer connections with nature.

Transportation within ${topic} offers multiple options for exploring different regions efficiently and comfortably. Well-maintained road networks make self-drive adventures possible, while public transportation systems provide economical and environmentally responsible alternatives. Specialized tour operators offer guided experiences focused on specific interests such as wildlife observation, cultural immersion, adventure sports, or culinary exploration.

Shopping opportunities range from bustling markets selling fresh local produce and handcrafted items to sophisticated retail districts featuring both international brands and locally designed products. Traditional crafts include textiles woven using ancient techniques, pottery shaped by methods unchanged for centuries, and jewelry incorporating local materials and cultural motifs.

When planning your visit to ${topic}, consider seasonal variations that affect weather conditions, festival schedules, and tourist crowds. Spring brings mild temperatures and blooming landscapes perfect for outdoor activities and photography. Summer offers warm weather ideal for water activities and extended daylight hours for sightseeing. Autumn provides comfortable temperatures, harvest festivals, and spectacular foliage displays. Winter presents unique opportunities for seasonal sports, holiday celebrations, and cozy indoor cultural experiences.

Essential preparation includes researching local customs, learning basic phrases in the local language, and understanding cultural etiquette that demonstrates respect for local traditions. Currency exchange, travel insurance, and appropriate clothing for local climate conditions ensure comfortable and worry-free experiences throughout your journey.

Photography enthusiasts will find endless inspiration in ${topic}, from dramatic landscape compositions and architectural details to vibrant street scenes and cultural celebrations. Golden hour lighting creates magical conditions for capturing the natural beauty, while blue hour photography reveals the charm of illuminated historical buildings and bustling evening markets. Understanding local photography customs and restrictions ensures respectful documentation of your experiences.

Sustainable travel practices in ${topic} help preserve the destination for future generations while supporting local communities and environmental conservation efforts. Choosing eco-friendly accommodations, supporting local businesses, minimizing plastic waste, and respecting wildlife habitats contribute to responsible tourism that benefits both visitors and residents. Many destinations now offer carbon offset programs and volunteer opportunities for travelers who want to give back.

Health and safety considerations vary by region, but general preparation includes consulting travel health advisors, obtaining necessary vaccinations, purchasing comprehensive travel insurance, and understanding local emergency services and medical facilities. Staying hydrated, protecting against sun exposure, and being aware of altitude changes helps maintain good health throughout your journey.

Cultural immersion opportunities extend beyond typical tourist attractions to include home-stays with local families, participation in traditional ceremonies and festivals, learning traditional crafts or cooking techniques, and engaging in community volunteer projects. These deeper connections create meaningful exchanges that enrich both travelers and host communities while supporting cultural preservation efforts.

Budget planning for ${topic} should account for accommodation, transportation, meals, activities, souvenirs, and unexpected expenses. Understanding local tipping customs, negotiation practices in markets, and seasonal price variations helps maximize value while ensuring fair compensation for local services. Many destinations offer city passes, cultural cards, or tourist packages that provide discounted access to multiple attractions.

Language learning, even basic phrases, dramatically enhances travel experiences by facilitating communication with locals, showing cultural respect, and opening doors to authentic interactions that wouldn't otherwise be possible. Mobile translation apps, phrasebooks, and language learning resources help overcome communication barriers while demonstrating genuine interest in local culture.

Connectivity and digital considerations help modern travelers stay connected while managing technology use to enhance rather than distract from travel experiences. Understanding local internet availability, international phone plans, portable WiFi options, and offline app capabilities ensures access to important information and services while maintaining flexibility to disconnect and fully immerse in local experiences.

Travel documentation and record keeping help preserve memories while managing important logistics throughout your journey. Digital and physical backup copies of important documents, travel insurance information, emergency contacts, and itinerary details provide security and peace of mind. Creating travel journals, photo albums, and experience logs transforms temporary trips into lasting memories and valuable resources for future adventures.

${topic} represents more than just a travel destination; it's an opportunity for personal growth, cultural understanding, and creating memories that will enrich your perspective on the world. Every corner reveals new discoveries, every conversation with locals provides insights into different ways of life, and every experience contributes to a deeper appreciation of our shared humanity and the incredible diversity of our planet. The transformative power of travel lies not just in the places you visit, but in the person you become through these extraordinary experiences.`;
    } else if (category === 'food') {
      script = `Welcome to the extraordinary culinary universe of ${topic}! Prepare yourself for an immersive gastronomic journey that explores every facet of this remarkable cuisine, from its ancient origins and traditional techniques to modern interpretations and global influence that has captivated food enthusiasts worldwide.

The historical foundations of ${topic} cuisine stretch back thousands of years, deeply rooted in agricultural traditions, geographical advantages, and cultural exchanges that have shaped its distinctive character. Ancient civilizations in this region developed sophisticated farming techniques that maximized local growing conditions, cultivating unique varieties of grains, vegetables, and fruits that became fundamental ingredients in traditional recipes that survive to this day.

Traditional preparation methods represent centuries of culinary evolution, with master chefs and home cooks refining techniques through countless generations of experimentation and innovation. These time-honored approaches to food preparation emphasize harmony between ingredients, seasonal availability, and cooking methods that enhance natural flavors while preserving nutritional value. Hand-grinding spices, slow-cooking methods, and fermentation processes create complex flavor profiles that simply cannot be replicated through modern shortcuts.

The ingredient palette of ${topic} cuisine showcases remarkable diversity, incorporating everything from common staples found worldwide to exotic specialty items that grow only in specific microclimates within the region. Spice markets burst with aromatic treasures including rare varieties of pepper, saffron, cardamom, and dozens of other seasonings that add warmth, complexity, and medicinal properties to dishes. Fresh herbs provide bright flavors and visual appeal, while aged ingredients like fermented sauces and cured meats contribute deep, umami-rich notes.

Regional variations within ${topic} cuisine tell fascinating stories of local adaptation and creativity. Coastal areas naturally emphasize fresh seafood preparations, with fishing communities developing unique preservation techniques and flavor combinations that maximize the ocean's bounty. Mountain regions feature heartier fare designed to provide sustenance during harsh winters, incorporating preserved meats, root vegetables, and warming spices. Urban centers become melting pots where different regional styles merge and evolve into innovative fusion approaches.

Modern interpretations of classic ${topic} dishes demonstrate how traditional cuisine adapts to contemporary tastes and dietary requirements while maintaining essential character and authenticity. Innovative chefs worldwide have embraced these flavors, creating restaurant experiences that introduce traditional techniques to new audiences while respecting cultural origins and significance. Health-conscious adaptations reduce oil, sugar, and sodium content without sacrificing flavor complexity.

The nutritional aspects of ${topic} cuisine reflect ancient wisdom about food as medicine, with many traditional ingredients possessing scientifically proven health benefits. Anti-inflammatory spices, probiotic fermented foods, and antioxidant-rich vegetables provide natural disease prevention while creating incredibly satisfying meals. Traditional eating patterns emphasize balanced portions, seasonal eating, and mindful consumption that supports both physical health and environmental sustainability.

Cooking techniques specific to ${topic} cuisine require understanding both the science behind flavor development and the cultural significance of traditional methods. Proper spice toasting unlocks essential oils that create aromatic foundations for complex dishes. Layered cooking approaches build flavors gradually, allowing each ingredient to contribute its unique characteristics while harmonizing with others. Temperature control and timing become crucial elements that separate amateur attempts from authentic results.

Essential equipment for preparing authentic ${topic} dishes ranges from specialized cookware designed for specific techniques to simple hand tools that have remained unchanged for centuries. Traditional clay pots provide unique flavor development and heat distribution impossible to achieve with modern materials. Grinding stones create spice pastes with textures and flavor release that electric appliances cannot match. Understanding these tools and their proper use enhances both cooking results and cultural appreciation.

Home cooking applications make it possible for enthusiastic food lovers to recreate restaurant-quality ${topic} dishes in their own kitchens with proper instruction, quality ingredients, and patient practice. Starting with simpler recipes builds confidence and familiarity with flavor profiles before attempting more complex preparations. Building a well-stocked pantry of essential spices, sauces, and specialty ingredients creates possibilities for spontaneous cooking adventures.

Festival and celebration foods within ${topic} culture demonstrate how cuisine connects communities and preserves cultural identity across generations. Special occasion dishes require advanced preparation and often involve entire families working together to create elaborate meals that strengthen social bonds. Seasonal celebrations feature foods that highlight particular ingredients at their peak freshness and cultural significance.

The global influence of ${topic} cuisine continues expanding as international food scenes embrace authentic flavors and techniques. Food festivals, cooking classes, and cultural exchange programs introduce these traditions to new audiences while supporting cultural preservation efforts. Online communities share recipes, techniques, and stories that keep traditions alive while encouraging creative adaptations.

Restaurant trends featuring ${topic} cuisine range from street food stalls serving quick, authentic snacks to fine dining establishments creating sophisticated interpretations that elevate traditional dishes to artistic presentations. Food trucks and casual dining spots make these flavors accessible to broader audiences, while specialized restaurants focusing on specific regional variations provide deeper cultural experiences for dedicated enthusiasts.

Ingredient sourcing and quality selection play crucial roles in achieving authentic flavors and supporting sustainable food systems. Understanding seasonal availability, proper storage techniques, and quality indicators helps home cooks and professional chefs alike choose ingredients that deliver optimal taste and nutritional value. Building relationships with trusted suppliers, farmers markets, and specialty importers ensures access to authentic ingredients while supporting ethical sourcing practices.

Food pairing principles specific to ${topic} cuisine create harmonious meal compositions that balance flavors, textures, temperatures, and nutritional profiles. Understanding which dishes complement each other, appropriate beverage selections, and traditional serving sequences enhances dining experiences while honoring cultural customs and maximizing flavor appreciation.

Kitchen organization and meal planning strategies help home cooks efficiently prepare complex ${topic} dishes without feeling overwhelmed. Proper mise en place preparation, batch cooking techniques, and strategic ingredient preparation allow for smooth cooking processes and better results. Understanding which components can be prepared in advance saves time while maintaining quality and freshness.

Cultural significance and symbolic meanings behind specific ${topic} dishes add depth to culinary appreciation beyond simple taste enjoyment. Many traditional foods carry historical stories, religious significance, or seasonal celebrations that connect diners to cultural heritage and community traditions. Understanding these connections enhances the dining experience while showing respect for cultural origins.

Modern dietary adaptations make ${topic} cuisine accessible to people with various health requirements and lifestyle choices. Gluten-free, vegetarian, vegan, and other dietary modifications can often be achieved while maintaining essential flavors and cultural authenticity. Creative substitutions and modified techniques allow broader audiences to enjoy these culinary traditions.

Food preservation techniques traditional to ${topic} cuisine offer sustainable approaches to extending ingredient shelf life while developing complex flavors through fermentation, curing, drying, and pickling processes. These time-honored methods reduce food waste, create pantry staples, and add unique flavor dimensions that processed alternatives cannot match.

Seasonal cooking principles within ${topic} cuisine emphasize using ingredients at their peak freshness and availability, creating natural variety throughout the year while supporting local agriculture and sustainable food systems. Understanding seasonal rhythms helps cooks plan menus, preserve abundance during peak seasons, and appreciate the natural cycles that influence traditional recipes and cultural celebrations.

Cookware and equipment selection specific to ${topic} cuisine can significantly impact cooking results and authenticity. Traditional tools often provide unique advantages in terms of heat distribution, flavor development, and cultural connection that modern alternatives cannot fully replicate. Understanding the purpose and proper use of specialized equipment enhances both cooking outcomes and cultural appreciation.

Whether you're a complete beginner curious about new flavors or an experienced cook seeking to expand your culinary repertoire, ${topic} cuisine offers endless opportunities for discovery, creativity, and delicious satisfaction that will transform your understanding of how food can bring joy, health, and cultural connection to daily life. The journey of exploring this cuisine becomes a gateway to understanding different cultures, histories, and ways of life through the universal language of food.`;
    } else if (category === 'technology') {
      script = `Welcome to the comprehensive exploration of ${topic}! We're living in an unprecedented era of technological revolution where innovations are reshaping every aspect of human existence, and understanding these developments is absolutely crucial for navigating our rapidly evolving digital landscape and preparing for the extraordinary future that awaits us.

The foundational principles underlying modern ${topic} technology build upon decades of groundbreaking research, theoretical breakthroughs, and practical engineering achievements that seemed like pure science fiction just a generation ago. From early theoretical concepts proposed by visionary scientists to today's sophisticated implementations, this technological journey involves countless brilliant minds working collaboratively across disciplines to solve complex problems and unlock new possibilities for human advancement.

Current real-world applications of ${topic} technology are already transforming virtually every industry and aspect of daily life in remarkable ways that most people never fully realize or appreciate. Healthcare systems utilize these innovations for precise diagnostics, personalized treatments, and remote patient monitoring that saves lives and reduces costs. Educational institutions leverage these tools to create immersive learning experiences that adapt to individual student needs and learning styles. Transportation networks integrate these systems for traffic optimization, autonomous vehicle development, and logistics management that improves efficiency while reducing environmental impact.

The underlying technical mechanisms that make ${topic} technology function represent sophisticated combinations of hardware engineering, software development, data processing algorithms, and mathematical models that work together seamlessly to create seemingly magical results. Understanding these fundamental components helps us appreciate not just what the technology accomplishes, but why it works reliably and how it might evolve to address future challenges and opportunities.

Artificial intelligence and machine learning components integral to ${topic} technology demonstrate capabilities that continuously expand and improve through exposure to new data and refined algorithms. These systems can analyze vast datasets to identify patterns invisible to human observation, make predictions based on complex variable interactions, and even learn from their own mistakes to improve future performance. The convergence of processing power, algorithm sophistication, and data availability creates possibilities that seemed impossible just years ago.

Security and privacy considerations become increasingly critical as ${topic} technology becomes more pervasive throughout society and handles increasingly sensitive personal and organizational information. Protecting user data, preventing unauthorized access, maintaining system integrity, and ensuring ethical use of powerful capabilities requires ongoing attention to cybersecurity measures, privacy regulations, and ethical guidelines that balance innovation with responsibility and public trust.

Global implications and international collaboration surrounding ${topic} technology extend far beyond individual users or single companies to influence geopolitical relationships, economic development patterns, and cultural exchanges worldwide. Different countries and regions approach these technologies with varying regulatory frameworks, investment priorities, and cultural considerations that affect how innovations develop and spread throughout different societies and economic systems.

Future developments and emerging trends in ${topic} technology promise even more extraordinary capabilities and applications that could fundamentally transform how humans work, communicate, learn, and solve complex global challenges. Research laboratories worldwide are exploring breakthrough innovations in quantum computing, biotechnology integration, nanotechnology applications, and sustainable energy systems that could revolutionize everything from medical treatments to environmental protection and space exploration.

Economic impact and market transformation driven by ${topic} technology creates entirely new industries while disrupting traditional business models and employment patterns. Understanding these economic forces helps individuals and organizations adapt to changing opportunities while preparing for challenges associated with technological disruption, workforce transitions, and evolving skill requirements in an increasingly automated and digitally connected world.

Ethical considerations and social responsibility surrounding ${topic} technology require careful thought, ongoing dialogue, and proactive policy development to ensure that powerful technological capabilities serve human welfare and social progress. As these tools become more capable of affecting human lives and societal structures, we must grapple with questions about algorithmic bias, data ownership, digital equity, automation's impact on employment, and the kind of technologically enhanced future we want to create together.

Educational opportunities and career pathways in ${topic} technology offer exciting possibilities for students and professionals interested in contributing to this rapidly advancing field. Universities worldwide are developing specialized programs that combine technical skills with ethical reasoning, creative problem-solving, and interdisciplinary collaboration. Industry partnerships provide practical experience through internships, research projects, and mentorship programs that prepare the next generation of innovators and leaders.

Environmental sustainability and green technology applications within ${topic} demonstrate how innovation can address climate change, resource conservation, and environmental protection challenges. Smart systems optimize energy consumption, reduce waste generation, and monitor environmental conditions to support more sustainable practices across industries, communities, and individual households.

User experience and accessibility improvements ensure that ${topic} technology benefits diverse populations regardless of technical expertise, physical abilities, or economic circumstances. Inclusive design principles create interfaces and applications that work for people with disabilities, limited technical literacy, or restricted access to advanced hardware and high-speed internet connections.

Research methodology and scientific advancement in ${topic} technology rely on rigorous experimentation, peer review processes, and open collaboration that accelerates discovery and innovation. Academic institutions, private research laboratories, and government agencies work together to push the boundaries of what's possible while maintaining scientific integrity and reproducible results.

International standards and regulatory frameworks governing ${topic} technology help ensure interoperability, safety, and ethical use across different countries and organizations. These collaborative efforts balance innovation freedom with consumer protection, national security considerations, and human rights preservation in our increasingly connected global society.

Implementation strategies and best practices for organizations adopting ${topic} technology require careful planning, stakeholder engagement, and change management processes that ensure successful integration while minimizing disruption to existing operations. Pilot programs, training initiatives, and gradual rollout approaches help organizations maximize benefits while addressing potential challenges and resistance to change.

Cost-benefit analysis and return on investment calculations help organizations and individuals make informed decisions about ${topic} technology adoption. Understanding both immediate costs and long-term value propositions enables better resource allocation and strategic planning that aligns technology investments with organizational goals and personal objectives.

Technical support and maintenance requirements for ${topic} systems ensure reliable operation and optimal performance over time. Understanding service agreements, update schedules, troubleshooting procedures, and backup strategies helps users maximize technology benefits while minimizing downtime and operational disruptions that could impact productivity and user satisfaction.

Integration challenges and compatibility considerations become increasingly important as ${topic} technology intersects with existing systems, legacy infrastructure, and diverse technology ecosystems. Understanding interoperability requirements, data migration needs, and system architecture compatibility helps ensure smooth implementation and optimal performance across complex technology environments.

Performance metrics and success measurement criteria help organizations track the effectiveness of ${topic} technology implementations and identify areas for improvement or optimization. Establishing baseline measurements, monitoring key performance indicators, and conducting regular assessments enable continuous improvement and demonstrate value to stakeholders.

Training and skill development programs prepare individuals and organizations to effectively utilize ${topic} technology capabilities while staying current with rapidly evolving features and best practices. Comprehensive education initiatives, certification programs, and ongoing professional development opportunities ensure users can maximize technology benefits and adapt to future enhancements.

Whether you're a technology professional, student, business leader, or simply someone interested in understanding our digital future, staying informed about ${topic} technology developments is essential for making informed decisions, identifying opportunities, and participating meaningfully in shaping how these powerful tools affect our society and our shared future on this planet. The key to success lies in balancing technological advancement with human values, ensuring that innovation serves to enhance rather than replace human capabilities and connections.`;
    } else {
      // Default comprehensive script
      script = `Welcome to this comprehensive and in-depth exploration of ${topic}! Today we're embarking on a thorough journey that will examine every significant aspect of this fascinating subject, uncovering detailed insights, practical applications, and broader implications that will provide you with a complete understanding of why this topic matters and how it impacts our world in both obvious and subtle ways.

Let's establish the fundamental concepts and core principles that form the essential foundation for understanding ${topic}. These underlying ideas have evolved significantly over time, shaped by extensive research, practical experience, changing social perspectives, and technological advances that reflect our growing knowledge and awareness of complex interconnections between different fields of study, cultural influences, and environmental factors.

The historical development of ${topic} provides crucial context for appreciating how current understanding and applications have emerged from centuries of human curiosity, experimentation, and gradual knowledge accumulation. Early developments often began with simple observations and basic theories that seemed primitive by today's standards but represented groundbreaking insights for their time periods. Medieval and Renaissance periods contributed significant advances through systematic study, improved methodologies, and cross-cultural knowledge exchange that laid groundwork for modern approaches.

The contemporary landscape of ${topic} reflects both remarkable achievements and ongoing challenges that define current research priorities, policy debates, and practical applications. Today's understanding incorporates sophisticated theoretical frameworks, advanced research methodologies, and interdisciplinary collaboration that creates comprehensive approaches to complex problems. Technological innovations provide powerful tools for investigation, analysis, and implementation that previous generations could never have imagined.

Key components and fundamental elements that constitute ${topic} each play distinct and important roles in the overall system or framework we're examining. Understanding these individual pieces and their intricate interactions helps us appreciate the complexity, elegance, and functionality of the complete picture. These relationships often involve feedback loops, emergent properties, and dynamic balances that create stability while allowing for adaptation and evolution.

Real-world applications demonstrate the practical importance and tangible impact of ${topic} in our daily lives, often in ways we might not immediately recognize or fully appreciate. Direct applications include obvious implementations that we encounter regularly through work, education, or personal activities. Indirect influences operate behind the scenes, affecting everything from economic systems and social structures to environmental conditions and technological capabilities that shape our modern world.

Expert perspectives and cutting-edge research findings provide valuable insights based on rigorous scientific study, professional experience, and scholarly analysis conducted by leading authorities in relevant fields. These contributions come from universities, research institutions, industry laboratories, and international organizations that dedicate significant resources to advancing knowledge and understanding. Peer review processes ensure reliability and validity of findings while promoting healthy scientific debate and continuous improvement.

Current challenges and emerging opportunities within ${topic} present both significant obstacles that require innovative solutions and exciting possibilities that could lead to breakthrough developments and improved outcomes. Identifying these areas helps us understand where focused attention and resources are most needed, where progress is likely to occur, and where unexpected discoveries might emerge from persistent effort and creative thinking.

Global perspectives reveal how ${topic} affects different cultures, societies, and regions around the world, often in ways that reflect local conditions, historical experiences, and cultural values. This international viewpoint helps us understand universal principles that apply across diverse contexts as well as important variations that reflect specific needs, circumstances, and approaches developed by different communities and nations.

Environmental considerations and sustainability aspects of ${topic} address how human activities and natural systems interact, affect each other, and create opportunities for more harmonious relationships between technological progress and environmental protection. Understanding these connections becomes increasingly important as we face global challenges related to climate change, resource conservation, and ecosystem preservation.

Economic implications and market dynamics surrounding ${topic} influence investment decisions, policy development, and individual choices that affect both local communities and global markets. These economic factors include direct costs and benefits, indirect effects on related industries, and long-term implications for economic growth, employment patterns, and wealth distribution across different populations and regions.

Social impact and cultural significance of ${topic} extend beyond technical or practical considerations to influence how communities function, how individuals relate to each other, and how societies address shared challenges and opportunities. These social dimensions include effects on education, communication, collaboration, creativity, and cultural expression that shape human experience and community development.

Future trends and potential developments suggest where ${topic} might evolve in coming years, though predicting specific outcomes remains challenging due to the complex interactions between technological advancement, social change, economic factors, and unpredictable events that can accelerate or redirect expected progress. Scenario planning and trend analysis help us prepare for likely possibilities while remaining flexible enough to adapt to unexpected developments.

Educational opportunities and skill development related to ${topic} provide pathways for individuals interested in contributing to this field or simply gaining deeper understanding for personal enrichment and professional advancement. These opportunities include formal academic programs, professional development courses, online learning resources, and hands-on experience opportunities that accommodate different learning styles, schedule constraints, and career objectives.

Research methodologies and analytical approaches used in studying ${topic} employ sophisticated techniques, advanced tools, and rigorous standards that ensure reliable results and meaningful conclusions. Understanding these methods helps evaluate information quality, interpret research findings, and distinguish between credible sources and unreliable claims in an era of information abundance.

Innovation and creativity within ${topic} drive continuous advancement and improvement through breakthrough discoveries, novel applications, and creative problem-solving approaches that challenge conventional thinking. Supporting innovation requires resources, collaboration, risk tolerance, and institutional frameworks that encourage experimentation while maintaining quality standards and ethical considerations.

Measurement and evaluation systems help track progress, assess outcomes, and identify areas requiring attention or improvement within ${topic}. Establishing clear metrics, conducting regular assessments, and analyzing trends provide valuable insights for decision-making and strategic planning that guide future development and resource allocation.

Collaboration and partnership opportunities create synergies between different organizations, disciplines, and stakeholders working within ${topic}. Successful partnerships leverage diverse strengths, share resources and expertise, and create outcomes that individual efforts could not achieve alone while managing potential conflicts and coordination challenges.

Quality assurance and standards development ensure consistent excellence and reliability across different aspects of ${topic}. Establishing benchmarks, implementing review processes, and maintaining certification programs protect stakeholder interests while promoting continuous improvement and innovation within acceptable risk parameters.

Communication and public engagement strategies help bridge gaps between experts and general audiences, making complex information about ${topic} accessible and relevant to broader communities. Effective communication requires understanding audience needs, using appropriate channels and formats, and presenting information in ways that educate and engage without oversimplifying or misrepresenting important concepts.

Policy development and regulatory frameworks provide governance structures that guide responsible development and implementation of initiatives related to ${topic}. Balancing innovation promotion with risk management, stakeholder protection, and public interest considerations requires careful analysis, inclusive consultation processes, and adaptive approaches that respond to changing circumstances.

Resource management and sustainability considerations ensure that activities related to ${topic} can continue effectively over time without depleting natural resources, overwhelming human capabilities, or creating unsustainable financial burdens. Long-term planning, efficiency improvements, and sustainable practices protect future opportunities while meeting current needs.

Whether you're completely new to this subject or seeking to deepen and expand your existing knowledge and understanding, this comprehensive exploration of ${topic} provides valuable insights, practical information, and thought-provoking perspectives that can enhance your appreciation of this important and fascinating area while encouraging further learning and engagement with these ideas in your personal and professional life. The journey of discovery never truly ends, as each new insight opens doors to additional questions and opportunities for growth and contribution.`;
    }

    console.log(`✅ Generated ${category} script with ${script.split(' ').length} words`);
    return script;
  }

  async testLLMConnection() {
    try {
      if (this.llmServer === 'openai') {
        return await this.testOpenAIConnection();
      } else if (this.llmServer === 'ollama') {
        return await this.testOllamaConnection();
      } else {
        console.log(`❌ Unknown LLM server: ${this.llmServer}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ ${this.llmServer} connection failed:`, error.message);
      return false;
    }
  }

  async testOpenAIConnection() {
    try {
      if (!this.openaiClient) {
        throw new Error('OpenAI client not configured');
      }
      
      // Test with a minimal request
      await this.openaiClient.chat.completions.create({
        model: this.openaiModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1,
      });
      
      console.log('✅ OpenAI connection successful');
      return true;
    } catch (error) {
      console.log('❌ OpenAI not available:', error.message);
      return false;
    }
  }

  async testOllamaConnection() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      console.log('✅ Ollama connection successful');
      return true;
    } catch (error) {
      console.log('❌ Ollama not available, will use fallback scripts');
      return false;
    }
  }
}

module.exports = new ScriptService();