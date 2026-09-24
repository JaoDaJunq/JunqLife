const { withProjectBuildGradle } = require('@expo/config-plugins')

const KOTLIN_VERSION = '2.3.21'

module.exports = function withKotlinCompiler(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('JunqLife Kotlin compiler patch expects Groovy android/build.gradle')
    }

    let contents = config.modResults.contents

    const versionless = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')"
    const propertyBased = /classpath\(kotlinVersion \? "org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$kotlinVersion" : 'org\.jetbrains\.kotlin:kotlin-gradle-plugin'\)/

    if (contents.includes(versionless)) {
      contents = contents.replace(
        versionless,
        `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}')`,
      )
    } else if (propertyBased.test(contents)) {
      contents = contents.replace(
        propertyBased,
        `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}')`,
      )
    }

    if (!contents.includes(`kotlin-gradle-plugin:${KOTLIN_VERSION}`)) {
      throw new Error('Could not pin Kotlin Gradle plugin compiler version')
    }

    config.modResults.contents = contents
    return config
  })
}
