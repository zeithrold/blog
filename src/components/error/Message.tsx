import type { PageErrorReceipe } from './const'
import { BiSolidError } from 'solid-icons/bi'
import { Match, Switch } from 'solid-js'
import { ERROR } from './const'

export interface MessageProps {
  errorCode: number
}

function messageIncluded(errorCode: number, error: PageErrorReceipe) {
  return Object.keys(error).includes(errorCode.toString())
}

interface MessageTemplateProps {
  title: string
  message: string
}

function MessageTemplate(props: MessageTemplateProps) {
  return (
    <div class={`
      m-4 flex max-w-96 items-center justify-center rounded-xl bg-gray-100 p-4
    `}
    >
      <BiSolidError class={`
        mr-2 text-2xl

        md:mr-4
      `}
      />
      <div class="flex flex-1 flex-col">
        <h1 class="text-xl font-bold">{props.title}</h1>
        <p>{props.message}</p>
      </div>
    </div>
  )
}

export default function Message(props: MessageProps) {
  return (
    <Switch>
      <Match when={messageIncluded(props.errorCode, ERROR)}>
        <MessageTemplate
          title={ERROR[props.errorCode].title}
          message={ERROR[props.errorCode].message}
        />
      </Match>
      <Match when={props.errorCode >= 500 && props.errorCode < 600}>
        <MessageTemplate
          title="Internal Server Error"
          message="An error occurred while processing your request."
        />
      </Match>
      <Match when={true}>
        <MessageTemplate
          title="Unknown Error"
          message="An unknown error occurred."
        />
      </Match>
    </Switch>
  )
}
