import Message from './Message'

export interface CardProps {
  errorCode: number
}

export default function Card(props: CardProps) {
  const currentDate = new Date()
  return (
    <div class="flex h-[100vh] w-full flex-col items-center justify-center">
      <Message errorCode={props.errorCode} />
      <div class="flex text-sm">
        <p>
          {currentDate.getFullYear()}
          {' '}
          Zeithrold's Blog
        </p>
      </div>
    </div>
  )
}
