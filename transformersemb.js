const http = require('http');
const querystring = require('querystring');
const url = require('url');

class EmbeddingsPipeline {
    static task = 'feature-extraction';
    static model = 'intfloat/multilingual-e5-small';
    static instance = null;
  
    static async getInstance(progress_callback = console.log) {
      if (this.instance === null) {
        let { pipeline, env } = await import('@huggingface/transformers');

        env.localModelPath = './models/';
        env.allowRemoteModels = false;
  
        this.instance = await pipeline(this.task, this.model, { dtype: "int8", progress_callback:progress_callback});
      }
  
      return this.instance;
    }
}

module.exports = {EmbeddingsPipeline};