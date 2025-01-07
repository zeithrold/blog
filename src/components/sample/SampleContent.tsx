import type { AuthorListType, TagType } from '../meta'
import image from '@/../public/sample.jpg'
import Image from 'next/image'
import { ContentCover, ContentTitle } from '../content'

const sampleAvatar = 'https://www.gravatar.com/avatar/87cf64b6bc54e4d82940c9fa41f7e3fd036064bdffc1189163b681d50531785b'
const sampleAuthorList: AuthorListType = [{
  name: 'Zeithrold',
  username: 'zeithrold',
  avatar: sampleAvatar,
}, {
  name: 'Zeithrold',
  username: 'zeithrold-2',
  avatar: sampleAvatar,
}, {
  name: 'Zeithrold',
  username: 'zeithrold-3',
  avatar: sampleAvatar,
}]
const sampleTitle = 'Sample Article'

const sampleTags: TagType[] = [{
  name: 'Machine Learning',
  slug: 'machine-learning',
  color: '#FFD700',
}, {
  name: 'Reinforcement Learning',
  slug: 'reinforcement-learning',
  color: '#FF4500',
}, {
  name: 'Deep Learning',
  slug: 'deep-learning',
  color: '#0000FF',
}]

const sampleDate = new Date('2022-01-01')

function SampleHtmlContent() {
  return (
    <div className={`
      prose max-w-full font-serif

      lg:prose-lg

      sm:prose-sm
    `}
    >
      <p>This is some basic, sample markdown.</p>
      <h2>Second Heading</h2>
      <ul>
        <li>Unordered lists, and:</li>
      </ul>
      <ol>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
      </ol>
      <ul>
        <li>More</li>
      </ul>
      <blockquote>
        <p>Blockquote</p>
      </blockquote>
      <p>
        And
        <strong>bold</strong>
        ,
        <em>italics</em>
        , and even
        <em>
          italics and later
          <strong>bold</strong>
        </em>
        . Even
        <del>strikethrough</del>
        .
        <a href="https://markdowntohtml.com">A link</a>
        {' '}
        to somewhere.
      </p>
      <p>And code highlighting:</p>
      <pre>
        <code className="language-js">
          {`var foo = "bar"
    function baz(s) {
       return foo + &#39;:&#39; + s;
    }`}
        </code>
      </pre>
      <p>
        Or inline code like
        <code>var foo = &#39;bar&#39;;</code>
        .
      </p>
      <p>Or an image of bears</p>
      <p><Image src={image} alt="bears" /></p>
      <p>The end ...</p>
    </div>
  )
}

export default function SampleContent() {
  return (
    <div className="flex flex-col items-center gap-16">
      <ContentCover />
      <div className="container flex flex-col items-center gap-16 p-4">
        <ContentTitle
          authors={sampleAuthorList}
          title={sampleTitle}
          tags={sampleTags}
          date={sampleDate}
        />
        <SampleHtmlContent />
      </div>
    </div>
  )
}
