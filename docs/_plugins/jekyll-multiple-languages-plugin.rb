module Jekyll
  @parsedlangs = {}
  def self.langs
    @parsedlangs
  end
  def self.setlangs(l)
    @parsedlangs = l
  end
  class Site
    alias :process_org :process
    def process
      if !self.config['baseurl']
        self.config['baseurl'] = ""
      end
      #Variables
      config['baseurl_root'] = self.config['baseurl']
      baseurl_org = self.config['baseurl']
      languages = self.config['languages']
      exclude_org = self.exclude
      dest_org = self.dest

      #Loop
      self.config['lang'] = self.config['default_lang'] = languages.first
      puts
      puts "Building site for default language: \"#{self.config['lang']}\" to: #{self.dest}"
      process_org
      languages.drop(1).each do |lang|

        # Build site for language lang
        @dest = @dest + "/" + lang
        self.config['baseurl'] = self.config['baseurl'] + "/" + lang
        self.config['lang'] = lang

        # exclude folders or files from beeing copied to all the language folders
        exclude_from_localizations = self.config['exclude_from_localizations'] || []
        @exclude = @exclude + exclude_from_localizations

        puts "Building site for language: \"#{self.config['lang']}\" to: #{self.dest}"
        process_org

        #Reset variables for next language
        @dest = dest_org
        @exclude = exclude_org

        self.config['baseurl'] = baseurl_org
      end
      Jekyll.setlangs({})
      puts 'Build complete'
    end
  end

  class LocalizeTag < Liquid::Tag

    def initialize(tag_name, key, tokens)
      super
      @key = key.strip
    end

    def render(context)
      if "#{context[@key]}" != "" #Check for page variable
        key = "#{context[@key]}"
      else
        key = @key
      end
      lang = context.registers[:site].config['lang']
      unless Jekyll.langs.has_key?(lang)
        puts "Loading translation from file #{context.registers[:site].source}/_i18n/#{lang}.yml"
        Jekyll.langs[lang] = YAML.load_file("#{context.registers[:site].source}/_i18n/#{lang}.yml")
      end
      translation = Jekyll.langs[lang].access(key) if key.is_a?(String)
      if translation.nil? or translation.empty?
        translation = Jekyll.langs[context.registers[:site].config['default_lang']].access(key)
        puts "Missing i18n key: #{lang}:#{key}"
        puts "Using translation '%s' from default language: %s" %[translation, context.registers[:site].config['default_lang']]
      end
      translation
    end
  end

  module Tags
    class LocalizeInclude < IncludeTag
      def render(context)
        if "#{context[@file]}" != "" #Check for page variable
          file = "#{context[@file]}"
        else
          file = @file
        end

        includes_dir = File.join(context.registers[:site].source, '_i18n/' + context.registers[:site].config['lang'])

        if File.symlink?(includes_dir)
          return "Includes directory '#{includes_dir}' cannot be a symlink"
        end
        if file !~ /^[a-zA-Z0-9_\/\.-]+$/ || file =~ /\.\// || file =~ /\/\./
          return "Include file '#{file}' contains invalid characters or sequences"
        end

        Dir.chdir(includes_dir) do
          choices = Dir['**/*'].reject { |x| File.symlink?(x) }
          if choices.include?(file)
            source = File.read(file)
            partial = Liquid::Template.parse(source)

            context.stack do
              context['include'] = parse_params(context) if @params
              contents = partial.render(context)
              site = context.registers[:site]
              ext = File.extname(file)

              converter = site.converters.find { |c| c.matches(ext) }
              contents = converter.convert(contents) unless converter.nil?

              contents
            end
          else
            "Included file '#{file}' not found in #{includes_dir} directory"
          end
        end
      end
    end
  end
end

unless Hash.method_defined? :access
  class Hash
    def access(path)
      ret = self
      path.split('.').each do |p|
        if p.to_i.to_s == p
          ret = ret[p.to_i]
        else
          ret = ret[p.to_s] || ret[p.to_sym]
        end
        break unless ret
      end
      ret
    end
  end
end

Liquid::Template.register_tag('t', Jekyll::LocalizeTag)
Liquid::Template.register_tag('translate', Jekyll::LocalizeTag)
Liquid::Template.register_tag('tf', Jekyll::Tags::LocalizeInclude)
Liquid::Template.register_tag('translate_file', Jekyll::Tags::LocalizeInclude)
